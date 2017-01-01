pragma solidity ^0.4.7;
contract DocumentVerify {
    address owner;
    uint latestDocument; //认证的文件个数
    struct DocumentTransfer {  //结构体，存储文件相关信息
        uint blockNumber;
        string hash;
        address from;
        address to;
        uint256 timeStamp;
    }
    mapping(uint => DocumentTransfer) private history;  //建立键值映射
    mapping(string => bool) private usedHashes;
    mapping(string => address) private documentHashMap;
	//事件，方便调试时显示信息
    event DocumentEvent(uint blockNumber, string hash, address from, address to, uint256 timeStamp);

	//构造函数
    function DocumentVerify(){
        owner = msg.sender; 
    }
    
	//将账户发到该智能合约的账款返回，属于智能合约安全性的操作。
    function empty(){
     uint256 balance = address(this).balance;
     if(!address(owner).send(balance))
        throw;
    }
    
	//传入hash值，将该哈希值保存在区块链中
    function newDocument(string hash) returns (bool success){
        if (documentExists(hash)) {
            success = false;
        }else{

            createHistory(hash, msg.sender, msg.sender);
            usedHashes[hash] = true;
            success = true;
        }
        return success;
    }

	//创建文件历史，即将该文件信息保存在区块链交易记录中
    function createHistory (string hash, address from, address to) internal{
            ++latestDocument;
            documentHashMap[hash] = to;
            usedHashes[hash] = true;
            history[latestDocument] = DocumentTransfer(block.number, hash, from, to, block.timestamp);
            DocumentEvent(block.number, hash, from,to, block.timestamp);
    }
    
	//文件所属权转移，输入文件hash,文件接收账户，返回布尔值判断是否转移成功。 该操作只能由文件所属者进行操作
    function transferDocument(string hash, address recipient) returns (bool success){
        success = false;
           
        if (documentExists(hash)){
            if (documentHashMap[hash] == msg.sender){
                createHistory(hash, msg.sender, recipient);
                success = true;
            }
        }
         
        return success;
    }
    
	//通过hash值查询文件在区块链中是否被认证
    function documentExists(string hash) public constant returns (bool exists){
        if (usedHashes[hash]) {
            exists = true;
        }else{
            exists= false;
        }
        return exists;
    }
    

	//通过文件id查询文件在区块链的信息，包括所在区块号，文件hash,发送账户，接受账户，文件被认证的时间戳
    function getDocument(uint docId) public constant returns (uint blockNumber, string hash, address from, address to, uint256 timeStamp){
        DocumentTransfer doc = history[docId];
        blockNumber = doc.blockNumber;
        hash = doc.hash;
        from = doc.from;
        to = doc.to;
        timeStamp = doc.timeStamp;
		return (blockNumber, hash, from, to, timeStamp);
    }
    
    
    //区块链中已认证的文件数量
    function getLatest() public constant returns (uint latest){
        return latestDocument;
    }
    

}
