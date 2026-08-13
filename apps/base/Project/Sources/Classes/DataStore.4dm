Class extends DataStoreImplementation

exposed Function getEntitySel()
	return ds.Car.all()
	
exposed Function getFirstCar()
	return ds.Car.all().first()
	
exposed Function sayHello($firstname : Text; $lastname : Text)
	return "Hello, "+$firstname+" "+$lastname
	
exposed onHTTPGet Function justATest($arg : Variant)
	// Uncomment ONE example to test the REST response type.
	
	// Example 1: 4D.Blob (UTF-8 text)
	// var $blob : 4D.Blob
	// CONVERT FROM TEXT("Hello from justATest"; "UTF-8"; $blob)
	// return $blob
	
	// Example 2: 4D.File (binary download / file reference)
	return File("/PACKAGE/WebFolder/PDF.pdf")
	
	// Example 3: 4D.File (text file)
	// return File("/PACKAGE/WebFolder/text.txt")
	
	// Example 4: 4D.File (HTML)
	// return File("/PACKAGE/WebFolder/html.html")
	
	// Example 5: 4D.File (CSV)
	// return File("/PACKAGE/WebFolder/csv.csv")
	
	// Example 6: 4D.File (Markdown)
	// return File("/PACKAGE/WebFolder/markdown.md")
	
	// Example 7: 4D.Folder
	//return Folder("/PACKAGE/WebFolder")
	
	// Example 8: Mail attachment from file (4D.MailAttachment)
	//return MAIL New attachment(File("/PACKAGE/WebFolder/text.txt"))
	// or:
	// return 4D.MailAttachment.new(File("/PACKAGE/WebFolder/text.txt"))
	
	// Example 9: Mail attachment from blob
	// var $attBlob : 4D.Blob
	// CONVERT FROM TEXT("attachment body"; "UTF-8"; $attBlob)
	// return MAIL New attachment($attBlob; "note.txt"; ""; "text/plain")
	
	// Example 10: Formula
	//return Formula(ALERT("hello"))
	
	// Example 11: Formula (no parameters)
	// return Formula(Current date)
	
	// Example 12: 4D.OutgoingMessage - plain text body
	//var $msgText : 4D.OutgoingMessage
	//$msgText:=4D.OutgoingMessage.new()
	//$msgText.setBody("OutgoingMessage text body")
	//$msgText.setHeader("Content-Type"; "text/plain; charset=utf-8")
	//return $msgText
	
	// Example 13: 4D.OutgoingMessage - blob / PDF download
	// var $msgPdf : 4D.OutgoingMessage
	// var $pdf : 4D.File
	// $msgPdf:=4D.OutgoingMessage.new()
	// $pdf:=File("/PACKAGE/WebFolder/PDF.pdf")
	// $msgPdf.setBody($pdf.getContent())
	// $msgPdf.setHeader("Content-Type"; "application/pdf")
	// $msgPdf.setHeader("Content-Disposition"; "attachment; filename=\"PDF.pdf\"")
	// return $msgPdf
	
	// Example 14: 4D.OutgoingMessage - JSON object body
	// var $msgJson : 4D.OutgoingMessage
	// $msgJson:=4D.OutgoingMessage.new()
	// $msgJson.setBody(New object("ok"; True; "source"; "justATest"; "nested"; $isNested))
	// return $msgJson
	
	// Example 15: 4D.OutgoingMessage - custom status
	// var $msgErr : 4D.OutgoingMessage
	// $msgErr:=4D.OutgoingMessage.new()
	// $msgErr.setBody("Not found")
	// $msgErr.setHeader("Content-Type"; "text/plain")
	// $msgErr.status:=404
	// return $msgErr
	
	// Example 16: Text
	// return "plain text response"
	
	// Example 17: Object
	// return New object("hello"; "world"; "isNested"; $isNested; "when"; Timestamp)
	
	// Example 18: Collection
	// return New collection(1; "two"; New object("three"; 3); True; Null)
	
	// Example 19: Integer / Real / Boolean / Null
	// return 42
	// return 3.14
	// return True
	// return Null
	
	// Example 20: Entity
	// return ds.Car.all().first()
	
	// Example 21: Entity selection
	// return ds.Car.all().slice(0; 5)
	
	// Example 22: Picture (empty / from file if available)
	// var $pic : Picture
	// READ PICTURE FILE(File("/PACKAGE/WebFolder/image.png").platformPath; $pic)
	// return $pic
	
	// Example 23: Blob from file contents
	// return File("/PACKAGE/WebFolder/text.txt").getContent()
	
	// Example 24: Scalar Blob (TEXT TO BLOB)
	// var $scalarBlob : Blob
	// TEXT TO BLOB("scalar blob text"; $scalarBlob; UTF8 text without length)
	// return $scalarBlob
	
	// Example 25: Date / Time
	// return Current date
	// return Current time
	// return Timestamp
	