Class extends Entity

Function get description($event : Object)->$result : Text
	var $parts : Collection
	var $categoryLabel : Text
	var $departmentName : Text
	
	If ((This.name=Null) || (This.name=""))
		$event.result:=Null
		return 
	End if 
	
	$parts:=[This.name]
	
	If ((This.address#Null) && (This.address#""))
		$parts.push("located at "+This.address)
	End if 
	
	If (This.category#Null)
		$categoryLabel:=This.category.label
		If (($categoryLabel#Null) && ($categoryLabel#""))
			$parts.push("category "+$categoryLabel)
		End if 
	End if 
	
	If (This.department#Null)
		$departmentName:=This.department.name
		If (($departmentName#Null) && ($departmentName#""))
			$parts.push("in "+$departmentName)
		End if 
	End if 
	
	$result:=$parts.join(" ")+"."
	
Function event saving($event : Object)->$result : Object
	var $attr : Text
	
	For each ($attr; This.touchedAttributes())
		If (This._isProfileAttribute($attr))
			This._computeVector()
			return Null
		End if 
	End for each 
	
Function _isProfileAttribute($attributeName : Text)->$isProfile : Boolean
	return ($attributeName="name") || ($attributeName="address") || ($attributeName="ID_category_agency") || ($attributeName="ID_department")
	
Function _refreshVector()->$result : Object
	This._computeVector()
	
	If (This.vector#Null)
		This.save()
	End if 
	
	return Null
	
Function _computeVector()
	var $text : Text
	var $client : cs.AIKit.OpenAI
	var $embedding : cs.AIKit.OpenAIEmbeddingsResult
	
	$text:=This.description
	
	If (($text=Null) || ($text=""))
		return 
	End if 
	
	Try
		$client:=This._embeddingClient()
		$embedding:=$client.embeddings.create($text; "text-embedding-3-small")
		
		If ($embedding.success)
			This.vector:=$embedding.vector
		End if 
		
	Catch
		// Leave vector unset on embedding failure; save continues.
	End try
	
Function _embeddingClient()->$client : cs.AIKit.OpenAI
	var $providers : cs.AIKit.OpenAIProviders
	var $provider : Object
	
	$providers:=cs.AIKit.OpenAIProviders.new()
	$provider:=$providers.get("OpenAI")
	
	If ($provider=Null)
		throw(100; "OpenAI provider not found in AIProviders.json")
	End if 
	
	return cs.AIKit.OpenAI.new($provider)
