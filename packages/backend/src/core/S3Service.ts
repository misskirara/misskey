/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { URL } from 'node:url';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as https from 'node:https';
import { Injectable } from '@nestjs/common';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { NodeHttpHandler, NodeHttpHandlerOptions } from '@smithy/node-http-handler';
import type { MiMeta } from '@/models/Meta.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import { bindThis } from '@/decorators.js';
import type { DeleteObjectCommandInput, PutObjectCommandInput } from '@aws-sdk/client-s3';

@Injectable()
export class S3Service {
	constructor(
		private httpRequestService: HttpRequestService,
	) {
	}

	@bindThis
	public getS3Client(meta: MiMeta): S3Client {
		const u = meta.objectStorageEndpoint
			? `${meta.objectStorageUseSSL ? 'https' : 'http'}://${meta.objectStorageEndpoint}`
			: `${meta.objectStorageUseSSL ? 'https' : 'http'}://example.net`; // dummy url to select http(s) agent

		const agent = this.httpRequestService.getAgentByUrl(new URL(u), !meta.objectStorageUseProxy, true);
		const handlerOption: NodeHttpHandlerOptions = {};
		if (meta.objectStorageUseSSL) {
			handlerOption.httpsAgent = agent as https.Agent;
		} else {
			handlerOption.httpAgent = agent as http.Agent;
		}

		return new S3Client({
			endpoint: meta.objectStorageEndpoint ? u : undefined,
			credentials: (meta.objectStorageAccessKey !== null && meta.objectStorageSecretKey !== null) ? {
				accessKeyId: meta.objectStorageAccessKey,
				secretAccessKey: meta.objectStorageSecretKey,
			} : undefined,
			region: meta.objectStorageRegion ? meta.objectStorageRegion : undefined, // 空文字列もundefinedにするため ?? は使わない
			tls: meta.objectStorageUseSSL,
			forcePathStyle: meta.objectStorageEndpoint ? meta.objectStorageS3ForcePathStyle : false, // AWS with endPoint omitted
			requestHandler: new NodeHttpHandler(handlerOption),
			requestChecksumCalculation: 'WHEN_REQUIRED',
			responseChecksumValidation: 'WHEN_REQUIRED',
		});
	}

	@bindThis
	public getOCIClient(meta: MiMeta): S3Client {
		const uo = `${meta.objectStorageUseSSL ? 'https' : 'http'}://${String(process.env.OCI_ENDPOINT)}`;
		const agento = this.httpRequestService.getAgentByUrl(new URL(uo), !meta.objectStorageUseProxy, true);
		const handlerOptiono: NodeHttpHandlerOptions = {};
		if (meta.objectStorageUseSSL) {
			handlerOptiono.httpsAgent = agento as https.Agent;
		} else {
			handlerOptiono.httpAgent = agento as http.Agent;
		}

		return new S3Client({
			endpoint: uo,
			credentials: {
				accessKeyId: String(process.env.OCI_ACCKEY),
				secretAccessKey: String(process.env.OCI_SECKEY),
			},
			region: String(process.env.OCI_REGION),
			tls: meta.objectStorageUseSSL,
			forcePathStyle: meta.objectStorageS3ForcePathStyle,
			requestHandler: new NodeHttpHandler(handlerOptiono),
			requestChecksumCalculation: 'WHEN_REQUIRED',
			responseChecksumValidation: 'WHEN_REQUIRED',
		});
	}	

	@bindThis
	public async upload(meta: MiMeta, input: PutObjectCommandInput, path: string) {
		const oci_client=this.getOCIClient(meta);
		const client = this.getS3Client(meta);
		const input_oci={...input,Bucket:String(process.env.OCI_BUCKET)}
		new Upload({
			client:oci_client,
			params: typeof input_oci.Body==="string" ? input_oci : {...input_oci,Body:fs.createReadStream(path)},
			partSize: (oci_client.config.endpoint && (await oci_client.config.endpoint()).hostname === 'storage.googleapis.com')
				? 500 * 1024 * 1024
				: 8 * 1024 * 1024,
		}).done();

		return new Upload({
			client,
			params: input,
			partSize: (client.config.endpoint && (await client.config.endpoint()).hostname === 'storage.googleapis.com')
				? 500 * 1024 * 1024
				: 8 * 1024 * 1024,
		}).done();
		
	}

	@bindThis
	public delete(meta: MiMeta, input: DeleteObjectCommandInput) {
		const client = this.getS3Client(meta);
		return client.send(new DeleteObjectCommand(input));
	}
}
