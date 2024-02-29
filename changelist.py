import psycopg2
import yaml
import os

cfgpath='./.config/default.yml'
blpath='block_list'
sfpath='safe_list'
lspath='liststatus'
file_list=['{}']

misscfg=''
with open(cfgpath, 'r') as yml:
    misscfg = yaml.safe_load(yml)

liststatus='block'
if(os.path.isfile(lspath)):
  with open(lspath, mode='r') as f:
    liststatus=f.readlines()

#print(os.environ['SAFE_LIST']+":"+liststatus[0])
if((os.environ['SAFE_LIST']=='true'and liststatus[0]=='safe')or
  (os.environ['SAFE_LIST']=='false'and liststatus[0]=='block')):
  print("[INFO] The list was allready changed. No changing.")
  exit()


if(os.environ['SAFE_LIST']=='true'):   # Change to Safe List
  if(os.path.isfile(sfpath)):
    with open(sfpath, mode='r') as f:
      file_list=f.readlines()
else:                                  # Change to Block List
  if(os.path.isfile(blpath)):
    with open(blpath, mode='r') as f:
      file_list=f.readlines()

connection = psycopg2.connect("host="+misscfg['db']['host']+" port="+str(misscfg['db']['port'])+" dbname="+misscfg['db']['db']+" user="+misscfg['db']['user']+" password="+misscfg['db']['pass'])
cursor = connection.cursor()
cursor.execute('select "blockedHosts" from meta')
res=cursor.fetchall()
db_list = '{'+str(res[0][0]).strip('[]')+'}'
print('[INFO] These hosts had be registered in the list.')
print(db_list)
print('[INFO] These hosts will be registered in the list.')
print(str(file_list[0]).replace("'",""))

cursor.execute('update meta SET "blockedHosts"=\''+str(file_list[0]).replace("'","")+'\'')
connection.commit()

if(liststatus[0]=='block'):            # Change to Safe List
  with open(blpath, mode='w') as f:
    f.writelines(db_list)
  with open(lspath, mode='w') as f:
    f.writelines('safe')
else:                                  # Change to Block List
  with open(sfpath, mode='w') as f:
    f.writelines(db_list)
  with open(lspath, mode='w') as f:
    f.writelines('block')


