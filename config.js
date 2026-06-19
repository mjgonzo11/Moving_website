version: 1
frontend:
  phases:
    build:
      commands:
        - printf 'window.QUOTE_API_URL = "%s";\n' "$QUOTE_API_URL" > config.js
  artifacts:
    baseDirectory: .
    files:
      - "**/*"
  cache:
    paths: []
