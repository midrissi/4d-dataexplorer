Class extends DataClass

exposed Function generateMissingVectors()->$result : Object
	var $agencies : cs.AgencySelection
	var $agency : cs.AgencyEntity
	var $updated : Integer
	var $failed : Integer
	var $skipped : Integer
	
	$agencies:=ds.Agency.query("vector = null")
	$updated:=0
	$failed:=0
	$skipped:=0
	
	For each ($agency; $agencies)
		If (($agency.description=Null) || ($agency.description=""))
			$skipped+=1
		Else 
			$agency._refreshVector()
			
			If ($agency.vector#Null)
				$updated+=1
			Else 
				$failed+=1
			End if 
		End if 
	End for each 
	
	return {\
		success: True; \
		total: $agencies.length; \
		updated: $updated; \
		failed: $failed; \
		skipped: $skipped}
