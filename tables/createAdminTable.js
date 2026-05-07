require("dotenv").config();

const { CreateTableCommand } = require("@aws-sdk/client-dynamodb");
const { client } = require("../config/db");

async function createAdminTable() {
  const params = {
    TableName: "Admin",
    KeySchema: [
      { AttributeName: "id",        KeyType: "HASH"  },
      { AttributeName: "createdAt", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "id",        AttributeType: "S" }, // table HASH key
      { AttributeName: "createdAt", AttributeType: "S" }, // table SORT key
      { AttributeName: "email",     AttributeType: "S" }, // GSI HASH key
      { AttributeName: "phone",     AttributeType: "S" }, // GSI HASH key
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "EmailIndex",
        KeySchema: [
          { AttributeName: "email", KeyType: "HASH" },
        ],
        Projection: { ProjectionType: "ALL" },
      },
      {
        IndexName: "PhoneIndex",
        KeySchema: [
          { AttributeName: "phone", KeyType: "HASH" },
        ],
        Projection: { ProjectionType: "ALL" },
      },
    ],
    BillingMode: "PAY_PER_REQUEST",
  };

  try {
    const result = await client.send(new CreateTableCommand(params));
    console.log("Admin table created:", result.TableDescription.TableArn);
  } catch (err) {
    if (err.name === "ResourceInUseException") {
      console.log("Admin table already exists");
    } else {
      console.error("Error creating table:", err.message);
      process.exitCode = 1;
    }
  }
}

createAdminTable();