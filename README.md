# go-doudou-rag

## 开发步骤
1. cd go-doudou-rag
2. go-doudou work init . 
3. go-doudou svc init module-auth -m go-doudou-rag/module-auth --module --case snake -t rest
4. When updated svc.go file, run go-doudou svc http --case snake or GDD_FIX_IMPORT=off go-doudou svc http --case snake. GDD_FIX_IMPORT=off is used for disable auto fix imports feature to solve performance issue when generating code in some kind of device.

## 测试
```shell
curl -w '\n' -N -X POST 'http://localhost:6060/modulechat/chat' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NTg5ODkzNDgsInVzZXJuYW1lIjoiYWRtaW4ifQ.Jq7wbyLTTEZqqSOst-PBy-bjQpyj4GQBJlx-qX9GHaY' \
--data '{
    "prompt": "最近杭州出台了什么经济相关的政策？"
}'
```

```shell
curl -w '\n' -N -X POST 'http://localhost:6060/modulechat/chat' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NTg5ODkzNDgsInVzZXJuYW1lIjoiYWRtaW4ifQ.Jq7wbyLTTEZqqSOst-PBy-bjQpyj4GQBJlx-qX9GHaY' \
--data '{
    "prompt": "Java的最新版本是哪个？"            
}'
```
