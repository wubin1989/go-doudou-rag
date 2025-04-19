# go-doudou-rag

## 开发步骤
1. cd go-doudou-rag
2. go-doudou work init . 
3. go-doudou svc init module-auth -m go-doudou-rag/module-auth --module --case snake -t rest
4. When updated svc.go file, run go-doudou svc http --case snake or GDD_FIX_IMPORT=off go-doudou svc http --case snake. GDD_FIX_IMPORT=off is used for disable auto fix imports feature to solve performance issue when generating code in some kind of device.