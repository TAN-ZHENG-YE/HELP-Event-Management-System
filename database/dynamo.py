import boto3, json, sys
from botocore.exceptions import ClientError

ENDPOINT_URL = None
TABLES = {
    "users": {
        "KeySchema": [
            {"AttributeName": "_id", "KeyType": "HASH"}
        ],
        "AttributeDefinitions": [
            {"AttributeName": "_id", "AttributeType": "S"},
            {"AttributeName": "email", "AttributeType": "S"},
        ],
        "GlobalSecondaryIndexes": [
            {
                "IndexName": "EmailIndex",
                "KeySchema": [
                    {"AttributeName": "email", "KeyType": "HASH"}
                ],
                "Projection": {"ProjectionType": "ALL"},
                "ProvisionedThroughput": {
                    "ReadCapacityUnits": 1,
                    "WriteCapacityUnits": 1
                }
            }
        ],
        "ProvisionedThroughput": {
            "ReadCapacityUnits": 1,
            "WriteCapacityUnits": 1
        }
    },
    "events": {
        "KeySchema": [
            {"AttributeName": "_id", "KeyType": "HASH"}
        ],
        "AttributeDefinitions": [
            {"AttributeName": "_id", "AttributeType": "S"},
        ],
        "ProvisionedThroughput": {
            "ReadCapacityUnits": 1,
            "WriteCapacityUnits": 1
        }
    },
    "tickets": {
        "KeySchema": [
            {"AttributeName": "_id", "KeyType": "HASH"}
        ],
        "AttributeDefinitions": [
            {"AttributeName": "_id", "AttributeType": "S"},
            {"AttributeName": "event_id", "AttributeType": "S"},
        ],
        "GlobalSecondaryIndexes": [
            {
                "IndexName": "EventTicketsIndex",
                "KeySchema": [
                    {"AttributeName": "event_id", "KeyType": "HASH"}
                ],
                "Projection": {"ProjectionType": "ALL"},
                "ProvisionedThroughput": {
                    "ReadCapacityUnits": 2,
                    "WriteCapacityUnits": 2
                }
            }
        ],
        "ProvisionedThroughput": {
            "ReadCapacityUnits": 2,
            "WriteCapacityUnits": 2
        }
    },
    "seats": {
        "KeySchema": [
            {"AttributeName": "_id", "KeyType": "HASH"}
        ],
        "AttributeDefinitions": [
            {"AttributeName": "_id", "AttributeType": "S"},
            {"AttributeName": "event_id", "AttributeType": "S"},
            {"AttributeName": "ticket_type_id", "AttributeType": "S"},
        ],
        "GlobalSecondaryIndexes": [
            {
                "IndexName": "EventSeatsIndex",
                "KeySchema": [
                    {"AttributeName": "event_id", "KeyType": "HASH"}
                ],
                "Projection": {"ProjectionType": "ALL"},
                "ProvisionedThroughput": {
                    "ReadCapacityUnits": 5,
                    "WriteCapacityUnits": 5
                }
            },
            {
                "IndexName": "TicketSeatsIndex",
                "KeySchema": [
                    {"AttributeName": "ticket_type_id", "KeyType": "HASH"}
                ],
                "Projection": {"ProjectionType": "ALL"},
                "ProvisionedThroughput": {
                    "ReadCapacityUnits": 5,
                    "WriteCapacityUnits": 5
                }
            }
        ],
        "ProvisionedThroughput": {
            "ReadCapacityUnits": 5,
            "WriteCapacityUnits": 5
        }
    },
    "seatbookings": {
        "KeySchema": [
            {"AttributeName": "_id", "KeyType": "HASH"}
        ],
        "AttributeDefinitions": [
            {"AttributeName": "_id", "AttributeType": "S"},
            {"AttributeName": "payment_id", "AttributeType": "S"},
        ],
        "GlobalSecondaryIndexes": [
            {
                "IndexName": "PaymentIndex",
                "KeySchema": [
                    {"AttributeName": "payment_id", "KeyType": "HASH"}
                ],
                "Projection": {"ProjectionType": "ALL"},
                "ProvisionedThroughput": {
                    "ReadCapacityUnits": 2,
                    "WriteCapacityUnits": 2
                }
            }
        ],
        "ProvisionedThroughput": {
            "ReadCapacityUnits": 2,
            "WriteCapacityUnits": 2
        }
    },
    "payments": {
        "KeySchema": [
            {"AttributeName": "_id", "KeyType": "HASH"}
        ],
        "AttributeDefinitions": [
            {"AttributeName": "_id", "AttributeType": "S"},
            {"AttributeName": "user_id", "AttributeType": "S"},
        ],
        "GlobalSecondaryIndexes": [
            {
                "IndexName": "UserIndex",
                "KeySchema": [
                    {"AttributeName": "user_id", "KeyType": "HASH"}
                ],
                "Projection": {"ProjectionType": "ALL"},
                "ProvisionedThroughput": {
                    "ReadCapacityUnits": 1,
                    "WriteCapacityUnits": 1
                }
            }
        ],
        "ProvisionedThroughput": {
            "ReadCapacityUnits": 1,
            "WriteCapacityUnits": 1
        }
    },
    "waitlists": {
        "KeySchema": [
            {"AttributeName": "_id", "KeyType": "HASH"}
        ],
        "AttributeDefinitions": [
            {"AttributeName": "_id", "AttributeType": "S"},
            {"AttributeName": "event_id", "AttributeType": "S"},
            {"AttributeName": "user_id", "AttributeType": "S"},
        ],
        "GlobalSecondaryIndexes": [
            {
                "IndexName": "EventIndex",
                "KeySchema": [
                    {"AttributeName": "event_id", "KeyType": "HASH"}
                ],
                "Projection": {"ProjectionType": "ALL"},
                "ProvisionedThroughput": {
                    "ReadCapacityUnits": 1,
                    "WriteCapacityUnits": 1
                }
            },
            {
                "IndexName": "UserIndex",
                "KeySchema": [
                    {"AttributeName": "user_id", "KeyType": "HASH"}
                ],
                "Projection": {"ProjectionType": "ALL"},
                "ProvisionedThroughput": {
                    "ReadCapacityUnits": 1,
                    "WriteCapacityUnits": 1
                }
            }
        ],
        "ProvisionedThroughput": {
            "ReadCapacityUnits": 1,
            "WriteCapacityUnits": 1
        }
    }
}

def create_table(table_name, config):
    DDB = boto3.resource("dynamodb", region_name="us-east-1", endpoint_url=ENDPOINT_URL)

    try:
        config["TableName"] = table_name

        table = DDB.create_table(**config)
        table.wait_until_exists()

        print("Created table: " + table_name)
        return True

    except ClientError as e:
        if e.response["Error"]["Code"] == "ResourceInUseException":
            print(f"⚠️ Table {table_name} already exists.")
        else:
            print(f"❌ Error creating {table_name}: {e}")

        return False

def batch_put(table_name, item_list):
    DDB = boto3.resource("dynamodb", region_name="us-east-1", endpoint_url=ENDPOINT_URL)
    table = DDB.Table(table_name)
    with table.batch_writer() as batch:
        for item in item_list:
            batch.put_item(Item=item)

    print("Added " + str(len(item_list)) + " items to " + table_name)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        ec2_url = input("Enter EC2 URL: ")
        ENDPOINT_URL = "http://" + ec2_url + ":8000"
    else:
        ENDPOINT_URL = sys.argv[1]

    for table_name, config in TABLES.items():
        is_created = create_table(table_name, config)

        if not is_created:
            continue

        with open("./" + table_name + ".json") as json_file:
            data = json.load(json_file)
        batch_put(table_name, data)
