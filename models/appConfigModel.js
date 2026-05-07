const { PutCommand, GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/db");
const { v4: uuidv4 } = require("uuid");

const TABLE = "AppConfig";

// CREATE — pehli baar config banao
async function createAppConfig() {
  const now = new Date().toISOString();

  const item = {
    id: "app-config",             // fixed id — always ek hi record rahega
    app_name:       "",
    app_email:      "",
    app_mobile:     "",
    app_detail:     "",
    admin_logo:     "",
    user_logo:      "",
    favicon:        "",
    address:        "",
    latitude:       "",
    longitude:      "",
    facebook:       "",
    twitter:        "",
    instagram:      "",
    linkedin:       "",
    app_details:    "",
    app_footer_text:"",

    // Nested array — DynamoDB mein List of Maps ke roop mein store hoga
    payment_methods: [
      { type: "cod",    isActive: true },
      { type: "online", isActive: true },
    ],

    // Nested array with credentials object
    payment_gateways: [],   // default empty — baad mein add karo

    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(new PutCommand({
    TableName: TABLE,
    Item: item,
    ConditionExpression: "attribute_not_exists(id)", // agar already hai toh overwrite mat karo
  }));

  return item;
}

// GET config
async function getAppConfig() {
  const { Item } = await docClient.send(new GetCommand({
    TableName: TABLE,
    Key: { id: "app-config" },
  }));
  return Item || null;
}

// UPDATE config fields
async function updateAppConfig(updates) {
  const exprNames  = {};
  const exprValues = { ":updatedAt": new Date().toISOString() };
  let   setExpr    = "SET updatedAt = :updatedAt";

  for (const [key, val] of Object.entries(updates)) {
    exprNames[`#${key}`]  = key;
    exprValues[`:${key}`] = val;
    setExpr += `, #${key} = :${key}`;
  }

  const { Attributes } = await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { id: "app-config" },
    UpdateExpression: setExpr,
    ExpressionAttributeNames:  exprNames,
    ExpressionAttributeValues: exprValues,
    ReturnValues: "ALL_NEW",
  }));

  return Attributes;
}

module.exports = { createAppConfig, getAppConfig, updateAppConfig };