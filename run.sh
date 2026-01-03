#!/bin/bash

FILE="labsuser.pem"

echo "checking $FILE"
if [ -e $FILE ]; then
  echo "setting permission"
  chmod 400 $FILE
else
  echo "$FILE not exist. Please place $FILE at here!"
  exit
fi

account_id=$(aws sts get-caller-identity |grep Account|cut -d '"' -f4)
appServerIp=$(aws ec2 describe-instances --filters "Name=tag:Name,Values='MonolithicAppServer'" --query 'Reservations[].Instances[].[PrivateIpAddress]' --output text)

echo "adding security group inbound port 8000"
securityGroupId=$(aws ec2 describe-instances --filters "Name=tag:Name,Values='MonolithicAppServer'" --query 'Reservations[].Instances[].SecurityGroups[].[GroupId]' --output text)
aws ec2 authorize-security-group-ingress --group-id $securityGroupId --protocol tcp --port 8000 --cidr 10.16.0.0/16 --description "Allow dynamo db port from private"

echo "copying file to app server"
scp -r -i ./labsuser.pem ./setup-dynamo.sh ubuntu@$appServerIp:/home/ubuntu/

echo "execute setup-dynamo.sh"
ssh -i ./labsuser.pem ubuntu@$appServerIp "chmod +x ./setup-dynamo.sh && ./setup-dynamo.sh"

echo "install boto3 package"
pip install boto3

echo "import data into dynamo db"
cd ~/environment/database/
python3 dynamo.py "http://$appServerIp:8000"

echo "replacing <DYNAMO-ENDPOINT>"
sed -i "s|<DYNAMO-ENDPOINT>|http://$appServerIp:8000|g" ~/environment/deployment/taskdef-customer.json
sed -i "s|<DYNAMO-ENDPOINT>|http://$appServerIp:8000|g" ~/environment/deployment/taskdef-employee.json

echo "replacing <ACCOUNT-ID>"
sed -i "s|<ACCOUNT-ID>|$account_id|g" ~/environment/deployment/taskdef-customer.json
sed -i "s|<ACCOUNT-ID>|$account_id|g" ~/environment/deployment/taskdef-employee.json