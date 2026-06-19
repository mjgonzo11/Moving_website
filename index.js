AWSTemplateFormatVersion: "2010-09-09"
Transform: AWS::Serverless-2016-10-31
Description: AI quote API for the Amplify-hosted moving quote website.

Parameters:
  AllowedOrigin:
    Type: String
    Description: Your Amplify app origin, for example https://main.example.amplifyapp.com
  FromEmail:
    Type: String
    Description: Verified Amazon SES sender address.
  OwnerEmail:
    Type: String
    Description: Business inbox that receives lead notifications.
  BedrockModelId:
    Type: String
    Default: anthropic.claude-3-haiku-20240307-v1:0
    Description: Lower-cost Bedrock model used only for the customer-facing quote summary.
  EnableAiDescription:
    Type: String
    Default: "true"
    AllowedValues:
      - "true"
      - "false"
    Description: Set to false to skip Bedrock completely and use only manual summary text.

Globals:
  Function:
    Runtime: nodejs20.x
    Timeout: 30
    MemorySize: 512
    Environment:
      Variables:
        ALLOWED_ORIGIN: !Ref AllowedOrigin
        LEADS_TABLE: !Ref LeadsTable
        FROM_EMAIL: !Ref FromEmail
        OWNER_EMAIL: !Ref OwnerEmail
        BEDROCK_MODEL_ID: !Ref BedrockModelId
        ENABLE_AI_DESCRIPTION: !Ref EnableAiDescription

Resources:
  LeadsTable:
    Type: AWS::DynamoDB::Table
    Properties:
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: leadId
          AttributeType: S
      KeySchema:
        - AttributeName: leadId
          KeyType: HASH

  QuoteApi:
    Type: AWS::Serverless::HttpApi
    Properties:
      CorsConfiguration:
        AllowOrigins:
          - !Ref AllowedOrigin
        AllowHeaders:
          - content-type
        AllowMethods:
          - POST
          - OPTIONS

  QuoteFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: quote-function/
      Handler: index.handler
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref LeadsTable
        - Statement:
            - Effect: Allow
              Action:
                - bedrock:InvokeModel
              Resource: "*"
            - Effect: Allow
              Action:
                - ses:SendEmail
                - ses:SendRawEmail
              Resource: "*"
      Events:
        QuoteRoute:
          Type: HttpApi
          Properties:
            ApiId: !Ref QuoteApi
            Path: /quote
            Method: POST

Outputs:
  QuoteApiUrl:
    Description: Put this value in config.js as window.QUOTE_API_URL
    Value: !Sub "https://${QuoteApi}.execute-api.${AWS::Region}.amazonaws.com/quote"
  LeadsTableName:
    Value: !Ref LeadsTable
