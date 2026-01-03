cd ~/environment/microservices/

# get account id
account_id=$(aws sts get-caller-identity |grep Account|cut -d '"' -f4)

# customer docker
docker container stop customer_1
docker remove customer_1
docker rmi customer
docker build --tag $account_id.dkr.ecr.us-east-1.amazonaws.com/customer:latest ./customer
# docker build --tag customer ./customer

# employee docker
docker container stop employee_1
docker remove employee_1
docker rmi employee
docker build --tag $account_id.dkr.ecr.us-east-1.amazonaws.com/employee:latest ./employee
# docker build --tag employee ./employee

# clean up
docker system prune -f

# push image
docker push $account_id.dkr.ecr.us-east-1.amazonaws.com/customer:latest
docker push $account_id.dkr.ecr.us-east-1.amazonaws.com/employee:latest