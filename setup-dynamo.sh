#!/bin/bash
PID=$(pgrep -f "sudo node index.js")
sudo kill $PID

sudo apt install openjdk-21-jre-headless
sleep 2

wget https://d1ni2b6xgvw0s0.cloudfront.net/v2.x/dynamodb_local_latest.zip
unzip dynamodb_local_latest.zip
sleep 2

java -Djava.library.path=./DynamoDBLocal_lib -jar DynamoDBLocal.jar -sharedDb &

sudo sh -c "cat <<EOF > /etc/rc.local
#!/bin/bash
cd /home/ubuntu/
sudo java -Djava.library.path=./DynamoDBLocal_lib -jar DynamoDBLocal.jar -sharedDb
EOF
"
sudo chmod +x /etc/rc.local