var accounts;
var account;
var doc;
var hash;

function initialContract(){
	doc = DocumentVerify.deployed();
};

function getBlockChainInfo(){
	doc.getLatest.call().then(function(ret){
		for(var i = ret; i >0; i--)
		{
			doc.getDocument.call(i).then(function(result){
				console.log(result[4].toNumber());
				//区块号
				var blockNum = result[0].c[0];
				//hash
				var currentHash = result[1];
				//发送账户
				var from = result[2];
				//接受账户
				var to = result[3];
				//时间戳
				var time = result[4].toNumber();
			})
		}
	})
}
	
function docVerify(){
	doc.documentExists.call(hash).then(
		function(res){
			//console.log(hash);
			//console.log(res);
			if(res == true)
				alert("文件曾经在区块链中被确认！认证成功！");
			else
			{
				if(confirm("该文件没有在区块链中认证，您需要添加认证吗？"))
				{
					doc.newDocument(hash,{from: accounts[0], gas: 3000000}).then(function(tx){
						//console.log(tx);
						return doc.documentExists.call(hash); 
					}).then(function(res){
					//	console.log(res);	
						if(res == true) alert("添加成功！");
						else alert("添加失败");
					}).catch(function(e){
						console.log(e)});  
				}
				
				
			}
		});
	}
$('document').ready(function(){
	// $('.local-file-info').hide();
	// 导航设置
	$('#myTab a').click(function (e) {
	  e.preventDefault();
	  $(this).tab('show');
	});
	//upload
	$('.verify').click(docVerify);
	// 文件上传的读取操作
	$('#selectedFile').change(function(e){
		var fileReader = new FileReader(),
			blobSlice = File.prototype.mozSlice || File.prototype.webkitSlice || File.prototype.slice,  
	        file = e.target.files[0],  
	        chunkSize = 2097152,  
	        // read in chunks of 2MB  
	        chunks = Math.ceil(file.size / chunkSize),  
	        currentChunk = 0,  
	        spark = new SparkMD5();  

  		console.log(file);
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

    initialContract();
	getBlockChainInfo();
  });
}

