var accounts;
var account;
var doc;
var hash;
//初始胡合约
function initialContract(){
	doc = DocumentVerify.deployed();
};

//获取区块交易信息并显示在table中
function getBlockChainInfo(){
	$('.add-trade').html('');
	doc.getLatest.call().then(function(ret){
		if(ret == 0){
			$('.add-trade').html('<tr><td colspan="5">当前账户暂无验证记录。</td></tr>');
		}else {
			for(var i = ret; i >0; i--){
				doc.getDocument.call(i).then(function(result){
					//区块号
					var blockNum = result[0].c[0];
					//hash
					var currentHash = result[1];
					//发送账户
					var from = result[2];
					//接受账户
					var to = result[3];
					//时间戳
					var time = new Date(result[4]).toLocaleString().substr(0,10);

					var str = '<tr><td>'+blockNum+'</td><td>'
								+currentHash+'</td><td>'
								+from+'</td><td>'
								+to+'</td><td>'
								+time+'</td></tr>';
					$('.add-trade').append(str);
				})
			}
		}
	})
	
	// var result = [
	// {
	// 	blockNumL:01,
	// 	currentHash:"fksdfjksdfjsdkfjksf",
	// 	from:"黄振希",
	// 	to:"吴紫彪",
	// 	time:new Date().toLocaleString()
	// },
	// {
	// 	blockNumL:01,
	// 	currentHash:"fksdfjksdfjsdkfjksf",
	// 	from:"黄振希",
	// 	to:"吴紫彪",
	// 	time:new Date().toLocaleString()
	// },
	// {
	// 	blockNumL:01,
	// 	currentHash:"fksdfjksdfjsdkfjksf",
	// 	from:"黄振希",
	// 	to:"吴紫彪",
	// 	time:new Date().toLocaleString()
	// }];
	// for(var i = 0;i<result.length;i++){
	// 	var str = '<tr><td>'+result[i].blockNumL+'</td><td>'
	// 						+result[i].currentHash+'</td><td>'
	// 						+result[i].from+'</td><td>'
	// 						+result[i].to+'</td><td>'
	// 						+result[i].time.substr(0,10)+'</td></tr>';
	// 	$('.add-trade').append(str);
	// }
}
//验证
function docVerify(){
	doc.documentExists.call(hash).then(
		function(res){
			if(res == true)
				alert("文件曾经在区块链中被确认！认证成功！");
			else
			{
				if(confirm("该文件没有在区块链中认证，您需要添加认证吗？"))
				{
					doc.newDocument(hash,{from: accounts[0], gas: 3000000}).then(function(tx){
						return doc.documentExists.call(hash); 
					}).then(function(res){
						if(res) {
							getBlockChainInfo();
							alert("添加成功！");
						}else {alert("添加失败");}
					}).catch(function(e){
						console.log(e)});  
				}
			}
		});
	}
//转移
function transfer(){
	var fileHash = $('#filehash-input').val();
	var toAccount = $('#account-input').val();
	// console.log(toAccount)
	if(fileHash == ''){
		alert('请填写文件hash。');
		$('#filehash-input').focus();
		return;
	}
	if(toAccount == ''){
		alert('请填写转入账户。');
		$('#account-input').focus();
		return;
	}
	//传入后台需验证：1.文件是否存在；2.账户是否存在。

}

//主入口
$('document').ready(function(){
	getBlockChainInfo();
	// 导航设置
	$('#myTab a').click(function (e) {
	  e.preventDefault();
	  $(this).tab('show');
	});
	//按钮事件绑定
	$('.verify').click(docVerify);
	$('.transfer-btn').click(transfer);

	// 文件上传读取操作
	$('#selectedFile').change(function(e){
		var fileReader = new FileReader(),
			blobSlice = File.prototype.mozSlice || File.prototype.webkitSlice || File.prototype.slice,  
	        file = e.target.files[0],  
	        chunkSize = 2097152,  
	        // read in chunks of 2MB  
	        chunks = Math.ceil(file.size / chunkSize),  
	        currentChunk = 0,  
	        spark = new SparkMD5();  

  		// console.log(file);
  		$('.local-file-info').show();
	    $('.file-name').text(file.name);
	    $('.file-size').text(file.size);

	    var lastModifiedDate = new Date(file.lastModified);
	    $('.file-lastmodified').text(lastModifiedDate.toLocaleString());

  		// 启动读操作
  		loadNext();
  		// 读取完毕
  		fileReader.onload = function(e) {  
	        spark.appendBinary(e.target.result); // append binary string  
	        currentChunk++;  
	  
	        if (currentChunk < chunks) {  
	            loadNext();  
	        }  
	        else {  
				hash = spark.end();
	            $('.file-hash').text(hash);  
				console.log(hash);
	        }  
	    };  

	    function loadNext() {  
	        var start = currentChunk * chunkSize,  
	            end = start + chunkSize >= file.size ? file.size : start + chunkSize;  
	  
	        fileReader.readAsBinaryString(blobSlice.call(file, start, end));  
	    }; 
	});
})

//初始化,获取账户和交易信息
window.onload = function() {
  web3.eth.getAccounts(function(err, accs) {
    if (err != null) {
      alert("There was an error fetching your accounts.");
      return;
    }

    if (accs.length == 0) {
      alert("Couldn't get any accounts! Make sure your Ethereum client is configured correctly.");
      return;
    }

    accounts = accs;
    account = accounts[0];
	$('.current-account').text(account);

    initialContract();
	getBlockChainInfo();
  });
}

