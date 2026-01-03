# Event Management Webiste

## Project Overview
Cloud-based event management system with separate customer and employee portals. Built using microservices architecture for scalability and independent deployment. The application utilizes Docker containerization, AWS cloud infrastructure, and automated CI/CD pipelines for seamless development and deployment workflows.

## Features by Roles

### Customer Portal
- User registration and authentication
- Browse and search events
- Real-time seat booking with visual seat map
- Payment processing and ticket generation
- Waitlist management for sold-out events
- Booking history and profile management

### Employee Portal

#### a. Event Organizer
- Reset passwords for first-time organizers
- Create events with image uploads
- View all events (published + unpublished)
- Create and delete ticket categories
- Create and assign seat sections
- Publish events to public

#### b. Admin  
- Create event organizers with email notifications


## Database Schema

### Models (DynamoDB)
- **Users**: Authentication, profiles, roles
- **Events**: Event details, dates, venues, pricing
- **Seats**: Seat layout, availability, pricing tiers
- **SeatBookings**: Reservation status, customer mapping
- **Tickets**: Generated tickets
- **Payments**: Transaction records, payment methods
- **Waitlists**: Queue management for full events

## Technology Stack

### Backend
- **Runtime**: Node.js 20.x
- **Framework**: Express.js 5.1.0
- **Database**: AWS DynamoDB with Dynamoose ODM
- **Authentication**: JWT + bcryptjs
- **File Upload**: Multer
- **Email**: Nodemailer

### Frontend
- **Framework**: Angular (SPA)
- **Styling**: Angular Material + Custom CSS
- **Build**: Production-optimized chunks

### DevOps & AWS Cloud 
- **Containerization**: Docker
- **AWS Services**:
  - **Cloud9**: Cloud-based IDE for development
  - **CodeCommit**: Git repository hosting
  - **DynamoDB**: NoSQL database for all data models
  - **ECR (Elastic Container Registry)**: Docker image storage
  - **ECS (Elastic Container Service)**: Container orchestration and deployment
  - **CodeDeploy**: Automated deployment service
  - **CodePipeline**: CI/CD pipeline automation
  - **Application Load Balancer**: Traffic distribution and health checks
  - **Target Groups**: Load balancer routing targets



## Docker Setup

### Build and Run Services
```bash
# Customer Service
cd customer
docker build -t customer-service .
docker run -p 8080:8080 customer-service

# Employee Service  
cd employee
docker build -t employee-service .
docker run -p 8081:8081 employee-service
```

## AWS Microservices App Architecture Diagram
![alt text](Architecture%20Diagram.png)

## AWS Implementation Overview
*Refer to AWS Implementation.pdf for full step details*

### Phase 1: Development Environment Setup
1. **Cloud9 IDE**: Create development environment
2. **CodeCommit**: Initialize Git repository and push source code
3. **DynamoDB Setup**: Configure local DynamoDB on EC2 instance
   - Install DynamoDB local on MonolithicAppServer
   - Create database tables using Python script
   - Configure security groups for port 8000 access

### Phase 2: Containerization & Image Registry
1. **Docker Images**: Build separate images for customer/employee services
   - Configure Dockerfiles for each microservice
   - Set environment variables for DynamoDB connection
   - Test containers locally on ports 8080/8081
2. **ECR Repositories**: Create private repositories and push images
   - Authenticate Docker with ECR
   - Tag and push customer/employee images
   - Configure repository permissions

### Phase 3: ECS Orchestration
1. **ECS Cluster**: Create Fargate serverless cluster
2. **Task Definitions**: Configure container specifications
   - CPU/memory allocation
   - Port mappings and environment variables
   - IAM roles and logging configuration
3. **AppSpec Files**: Create CodeDeploy deployment specifications

### Phase 4: Load Balancing & Traffic Routing
1. **Target Groups**: Create 4 target groups (2 per microservice)
   - customer-tg-one, customer-tg-two
   - employee-tg-one, employee-tg-two
   - Configure health checks
2. **Application Load Balancer**: Route traffic based on path
   - HTTP:80 listener: Default to customer, /admin/* to employee
   - HTTP:8080 listener: Same routing pattern
   - Blue/Green deployment support

### Phase 5: ECS Service Deployment
1. **ECS Services**: Deploy microservices to target groups
   - Customer microservice → customer-tg-two
   - Employee microservice → employee-tg-two
   - Auto-scaling and health monitoring

### Phase 6: CI/CD Pipeline
1. **CodeDeploy Application**: Create deployment application with ECS platform
2. **Deployment Groups**: Configure blue/green deployments for each service
3. **CodePipeline**: Automated CI/CD workflows
   - **Source**: CodeCommit + ECR image triggers
   - **Deploy**: CodeDeploy with task definition updates
   - **Testing**: Automated deployment validation

### Production Features
- **Auto-scaling**: ECS service scaling (e.g., 3 customer containers)
- **Security**: IP-based access control for employee microservice
- **Monitoring**: CloudWatch logging and health checks
- **Blue/Green Deployment**: Zero-downtime updates


