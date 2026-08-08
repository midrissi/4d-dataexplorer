Class extends DataStoreImplementation

exposed Function getEntitySel()
	return ds.Car.all()
	
exposed Function getFirstCar()
	return ds.Car.all().first()
	
exposed Function sayHello($firstname : Text; $lastname : Text)
	return "Hello, "+$firstname+" "+$lastname
	
exposed onHTTPGet Function justATest($isNested : Boolean)
	var $myCode : Text
	$myCode:="#DECLARE ($number1:Integer;$number2:Integer):Integer"+Char(13)+"return $number1*$number2"
	
	var $o:={}
	// $o.multiplication:=4D.Method.new($myCode)  //put object in a property
	
	var $files:={}
	$files.jpg:=File("/RESOURCES/dataInit/malefaces/MDA0MzkuanBn.jpg")
	$files.csv:=File("/RESOURCES/dataInit/Agency.csv")
	$files.pdf:=File("/PACKAGE/WebFolder/PDF.pdf")
	
	// var $result3:=4D.Method.new($myCode)
	// return $files.jpg.getContent()
	return {code: $myCode; result1: $result2; result2: $o; attachment: 4D.MailAttachment.new($files.pdf)}
	// return Formula(ALERT())
	// return $result3