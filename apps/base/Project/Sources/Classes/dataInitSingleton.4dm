property running : Boolean
property task : Text
property subTask : Text
property progress : Integer
property tablesToDrop : Collection

shared singleton Class constructor()
	This.running:=False
	This.task:="idle"
	This.subTask:="none"
	This.progress:=100
	This.tablesToDrop:=New shared collection(\
		"CategoryAgency"; \
		"CategoryCar"; \
		"DefectCategory"; \
		"DefectiveElement"; \
		"Department"; \
		"OptionCategory"; \
		"Region"; \
		"Status"; \
		"OptionAvailable"; \
		"Color"; \
		"CarModel"; \
		"Agency"; \
		"Employee"; \
		"Customer"; \
		"Car"; \
		"Reservation"; \
		"Inventory"; \
		"Defect"; \
		"ChosenOptions")
	
	
exposed Function get status() : Object
	return {running: This.running; task: This.task; subTask: This.subTask; progress: This.progress}
	
	
Function dropAndResetTable($tableName : Text)
	var $result : Object
	$result:=ds[$tableName].all().drop()
	
Function randomRegistration() : Text
	var $firstPart; $secondPart; $thirdPart : Text
	var $secondPartNumber : Integer
	
	$firstPart:=Char((Random%26)+65)+Char((Random%26)+65)
	$secondPartNumber:=(Random%999)+1
	$secondPart:=(($secondPartNumber<100) ? "0" : "")+(($secondPartNumber<10) ? "0" : "")+String($secondPartNumber)
	$thirdPart:=Char((Random%26)+65)+Char((Random%26)+65)
	
	return $firstPart+"-"+$secondPart+"-"+$thirdPart
	
Function randInt($N : Integer) : Integer
	var $i; $Q; $R; $rd : Integer
	var $listRandom : Collection
	
	$N:=$N-1
	$Q:=$N\32767
	$R:=$N%32767
	
	$listRandom:=[]
	For ($i; 1; $Q)
		$listRandom.push(Random)
	End for 
	$listRandom.push(Random%(1+$R))
	$rd:=$listRandom.sum()
	
	return $rd
	
Function randomPhone() : Text
	return "0"+String((Random%(9999-1000+1))+1000)+String((Random%(9999-1000+1))+1000)+String((Random%9)+1)
	
shared Function createCars($nbCars : Integer; $nbDaysPast : Integer)
	var $today : Date:=Current date
	var $tires : Collection:=["Summer"; "Winter"; "All-season"]
	var $carModels : cs.CarModelSelection:=ds.CarModel.all()
	var $carColors : cs.ColorSelection:=ds.Color.all()
	var $agencies : cs.AgencySelection:=ds.Agency.all()
	var $rdAge : Integer
	var $choiceTires : Integer
	var $i : Integer
	var $car : cs.CarEntity
	
	For ($i; 1; $nbCars)  // Creation of nbCars cars
		This.progress:=Round($i/$nbCars*100; 0)
		$car:=ds.Car.new()
		$rdAge:=1+(Random%$nbDaysPast)  // car age in days, for later calculations
		$choiceTires:=Random%100  // 97% Summer, 2% All-seasons, 1% Winter
		
		$car.model:=$carModels[Random%$carModels.length]  // select random car model
		$car.buyingDate:=$today-$rdAge  // Random purchase date
		$car.mileage:=(31*$rdAge)  // The vehicule arrives news, then drives around 31 km per day
		$car.color:=$carColors[Random%$carColors.length]  // select random car color
		$car.inMaintenance:=False  // Car arrives in good state
		$car.tires:=($choiceTires<97) ? ($tires[0]) : (($choiceTires=99) ? $tires[1] : $tires[2])
		$car.agency:=$agencies[Random%$agencies.length]  // Assign random agency
		$car.nextTechnicalVisit:=$car.buyingDate+1277  // First tech visit after 3.5 years
		$car.endOfInsuranceValidity:=$car.buyingDate+(365*(Year of($today)-Year of($car.buyingDate)+1))  // 1 year insurance validity
		$car.lastOilChange:=($rdAge>322) ? ($car.buyingDate+322) : ($car.buyingDate)  // oil change every 10000 km, so for approx 31km/day =>  322d
		$car.registration:=This.randomRegistration()
		$car.save()
	End for 
	
Function createOptions($reservation : cs.ReservationEntity)
	var $nbOptions : Integer
	var $options : cs.OptionAvailableSelection
	var $i : Integer
	var $chosenOption : cs.ChosenOptionsEntity
	
	$nbOptions:=1+(Random%3)  // Between 1 and 3 options
	$options:=ds.OptionAvailable.all()
	
	For ($i; 1; $nbOptions)
		$chosenOption:=ds.ChosenOptions.new()
		$chosenOption.reservation:=$reservation
		$chosenOption.optionChosen:=$options[Random%$options.length]
		$chosenOption.save()
	End for 
	$reservation.save()
	
Function createInventory($reservation : cs.ReservationEntity; $departureFlag : Boolean) : cs.InventoryEntity
	var $inventory : cs.InventoryEntity
	var $defectiveElements : cs.DefectiveElementSelection:=ds.DefectiveElement.all()
	var $YesNoDefects : Integer:=Random%10
	var $defect : cs.DefectEntity
	var $remarks : Collection
	
	$remarks:=["The defect is very slight. There’s not a lot of damage to the part, but it has to be reported."; \
		"The defect is light, but there is a small difference compared to the original condition of the part."; \
		"The defect is fairly visible in relation to the normal condition of the vehicle. It should be notified and repaired."; \
		"The defect is rather annoying, one notices it visually and can cause discomfort."; \
		"An average defect. It is not essential to have it repaired, but it is starting to be desirable."; \
		"This is a defect that is quite visible, we can call it slightly above average, but it is quite repairable."; \
		"A defect that begins to be disabling, the defective element should be repaired or replaced as soon as possible."; \
		"The defect is of an advanced gravity level. The part must be repaired or replaced as soon as possible."; \
		"The defect is at the level of almost maximum severity, the repairers must act on the vehicle as soon as possible before its next booking."; \
		"The defect is at the maximum severity level, you must make an appointment with a mechanic to repair it as soon as possible."]
	
	$inventory:=ds.Inventory.new()
	$inventory.employee:=$reservation.employee
	If ($departureFlag)
		$inventory.date:=$reservation.departureDate
		$inventory.time:=$reservation.departureTime
		$inventory.reservationDeparture:=$reservation
	Else 
		$inventory.date:=$reservation.arrivalDate
		$inventory.time:=$reservation.arrivalTime
		$inventory.reservationArrival:=$reservation
	End if 
	
	$inventory.save()
	
	If ($YesNoDefects>8)
		$defect:=ds.Defect.new()
		$defect.inventory:=$inventory
		$defect.element:=$defectiveElements[Random%$defectiveElements.length]
		$defect.severity:=1+(Random%10)  // Severity from 1 to 10
		$defect.remark:=$remarks[$defect.severity-1]
		$defect.car:=$reservation.car
		$defect.save()
	End if 
	
shared Function createBookings($nbDaysFuture : Integer)
	var $today : Date
	var $dateEnd : Date
	var $cars : cs.CarSelection
	var $agencies : cs.AgencySelection
	var $listCustomers : cs.CustomerSelection
	var $valStatus : cs.StatusEntity
	var $availOptions : cs.OptionAvailableSelection
	var $abandonOption : cs.OptionAvailableEntity
	var $bookingDate : Date
	var $bookingDays : Integer
	var $reservation : cs.ReservationEntity
	var $option : cs.ChosenOptionsEntity
	var $status : Text
	var $car : cs.CarEntity
	var $hours : Collection
	
	$today:=Current date
	$dateEnd:=$today+$nbDaysFuture  // We'll create bookings until dateEnd
	$cars:=ds.Car.all()
	$agencies:=ds.Agency.all()
	$listCustomers:=ds.Customer.all()
	$valStatus:=ds.Status.query("label = 'Validated'").first()
	$availOptions:=ds.OptionAvailable.all()
	$abandonOption:=$availOptions.query("label = 'Car abandonment'").first()
	
	//Dropping tables
	This.dropAndResetTable("Reservation")
	This.dropAndResetTable("Inventory")
	This.dropAndResetTable("Defect")
	This.dropAndResetTable("ChosenOptions")
	$hours:=[?10:00:00?; ?10:30:00?; ?11:00:00?; ?11:30:00?; ?12:00:00?; ?14:00:00?; ?14:30:00?; ?15:00:00?; ?15:30:00?; ?16:00:00?; ?16:30:00?; ?17:00:00?; ?17:30:00?; ?18:00:00?; ?18:30:00?; ?19:00:00?]
	
	//Let's parse all cars in database to generate several bookings for each one of them
	For each ($car; $cars)
		This.progress:=Round($car.indexOf($cars)/$cars.length*100; 0)
		$bookingDate:=$car.buyingDate+1  //no bookings before car purchasing date
		
		While ($bookingDate<$dateEnd)
			$reservation:=ds.Reservation.new()
			$bookingDays:=2+(Random%9)  //bookings are between 2 and 10 days long
			
			$reservation.car:=$car
			$reservation.categoryCar:=$car.model.category  // save car category on booking, for alternatives
			$reservation.customer:=$listCustomers[This.randInt($listCustomers.length)]  //TODO: ugly way to randomize >+ 32k customer
			$reservation.departureAgency:=$car.agency
			$reservation.employee:=$reservation.departureAgency.employees[Random%$reservation.departureAgency.employees.length]
			
			// choose an arrival agency. In 98% cases: same as departure agency
			If ((Random%100)>98)  // different agency
				$reservation.arrivalAgency:=$agencies[Random%$agencies.length]
				//in such case, we add the abandon option to the booking
				$option:=ds.ChosenOptions.new()
				$option.reservation:=$reservation
				$option.optionChosen:=$abandonOption
				$option.save()
			Else   //same as departure
				$reservation.arrivalAgency:=$reservation.departureAgency
			End if 
			
			$reservation.departureDate:=$bookingDate
			$reservation.arrivalDate:=$reservation.departureDate+$bookingDays
			$reservation.departureTime:=$hours[Random%$hours.length]
			$reservation.arrivalTime:=$hours[Random%$hours.length]
			$reservation.status:=$valStatus  // all bookings are validated
			$reservation.price:=($car.model.dailyRentalPrice)*($bookingDays)
			
			If ((Random%10)<8)  // Options are added 7/10 times
				This.createOptions($reservation)  // let's create a booking option
			End if 
			
			$reservation.price+=$reservation.chosenOptions.optionChosen.sum("price")  // Update price with options
			
			// If booking is over, Inventory must be set as well as booking kilometers consumed and car mileage
			$status:=$reservation.quickStatus
			
			If ($status="Past")
				$reservation.departureInventory:=This.createInventory($reservation; True)
				$reservation.arrivalInventory:=This.createInventory($reservation; False)
				$reservation.kilometersConsumed:=$bookingDays*31  // let's add some km to the booking
				$car.mileage:=$car.mileage+$reservation.kilometersConsumed
				$car.save()
			Else 
				If ($status="On going")
					$reservation.departureInventory:=This.createInventory($reservation; True)
				End if 
				$reservation.kilometersConsumed:=0
			End if 
			
			$reservation.save()
			
			//prepare date for next booking creation
			//If booking starts later than in 15 days, then gap with next booking is between 5 to 15 days
			//Else (past booking or sooner than in next 15 days), gap with next booking is between 1 to 7 days.
			$bookingDate:=$reservation.arrivalDate+(($reservation.departureDate>=($today+15)) ? (5+(Random%11)) : (1+(Random%7)))
		End while 
	End for each 
	
shared Function genericCSVImport($csvFile : Text; $dataClass : Text; $spliter : Text)
	var $myFile : Text
	var $lines : Collection
	var $header : Collection
	var $fields : Collection
	var $relationDef : Collection
	var $i : Integer
	var $p : Integer
	var $newEntity : 4D.Entity
	var $targetEntity : 4D.Entity
	
	If (ds[$dataClass].all().length=0)  // import only if table is empty
		
		$myFile:=Folder("/RESOURCES/dataInit/").file($csvFile).getText("UTF-8")
		$myFile:=Replace string($myFile; "\r"; "")/* for windows */
		$lines:=Split string($myFile; "\n")/* Split csv into lines */
		$header:=Split string($lines[0]; $spliter)/* retrieve header */
		
		For ($i; 1; $lines.length-1)/* for each line after header */
			This.progress:=Round($i/($lines.length-1)*100; 0)
			$fields:=Split string($lines[$i]; $spliter)/* get all fields */
			If ($fields.length=$header.length)/* check if we have same amount of fields than headers */
				
				$newEntity:=ds[$dataClass].new()
				For ($p; 0; $header.length-1)/* for each field*/
					Case of 
						: (($fields[$p]="True") | ($fields[$p]="False"))/* if boolean like */
							$newEntity[$header[$p]]:=($fields[$p]="True")
						: ($header[$p]="$rel_@")/* relation, of course this could be optimized */
							$relationDef:=Split string($header[$p]; "_")
							If ($relationDef.length=4)
								$targetEntity:=ds[$relationDef[1]].query($relationDef[2]+" = '"+$fields[$p]+"'").first()
								$newEntity[$relationDef[3]]:=$targetEntity
							End if 
						Else 
							$newEntity[$header[$p]]:=$fields[$p]
					End case 
				End for 
				$newEntity.save()
			End if 
		End for 
	End if 
	
shared Function loadOptionPhotos()
	var $sel : cs.OptionAvailableSelection
	var $opt : cs.OptionAvailableEntity
	
	$sel:=ds.OptionAvailable.all()
	
	For each ($opt; $sel)
		This.progress:=Round($opt.indexOf($sel)/$sel.length*100; 0)
		$opt.photo:="/RESOURCES/dataInit/OptionImage/"+$opt.label+".jpg"
		$opt.save()
	End for each 
	
shared Function loadColorPhotos()
	var $sel : cs.ColorSelection
	var $col : cs.ColorEntity
	var $i : Integer
	
	$sel:=ds.Color.all()
	$i:=1
	
	For each ($col; $sel)
		This.progress:=Round($col.indexOf($sel)/$sel.length*100; 0)
		$col.photo:="/RESOURCES/dataInit/Colors/"+String($i)+".jpg"
		$col.save()
		$i:=$i+1
	End for each 
	
/* Selects a random manager for each agency without manager */
shared Function updateAgencies()
	var $employees : cs.EmployeeSelection
	var $agencies : cs.AgencySelection
	var $agency : cs.AgencyEntity
	
	$employees:=ds.Employee.all()
	$agencies:=ds.Agency.query("manager = null")
	
	For each ($agency; $agencies)
		This.progress:=Round($agency.indexOf($agencies)/$agencies.length*100; 0)
		$agency.manager:=$employees[Random%$employees.length]
		
		$employees:=$employees.minus($agency.manager)
		If ($employees.length=0)
			$employees:=ds.Employee.all()
		End if 
		$agency.save()
	End for each 
	
shared Function updateEmployeesInfos()
	var $sel : cs.EmployeeSelection
	var $agencies : cs.AgencySelection
	var $femalePhotoFiles : Collection
	var $malePhotoFiles : Collection
	var $fcount : Integer
	var $mcount : Integer
	var $photoFile : 4D.File
	var $emp : cs.EmployeeEntity
	var $managedAgencies : cs.AgencySelection
	
	$sel:=ds.Employee.all()
	$agencies:=ds.Agency.all()
	$femalePhotoFiles:=Folder("/RESOURCES/dataInit/femalefaces/").files()
	$malePhotoFiles:=Folder("/RESOURCES/dataInit/malefaces/").files()
	$fcount:=$femalePhotoFiles.length
	$mcount:=$malePhotoFiles.length
	
	For each ($emp; $sel)
		This.progress:=Round($emp.indexOf($sel)/$sel.length*100; 0)
		
		If ($emp.photo=Null)
			$photoFile:=(Random%2=0) ? ($femalePhotoFiles[Random%$fcount]) : ($malePhotoFiles[Random%$mcount])  // get employee photo
			$emp.photo:=$photoFile.path
		End if 
		
		If ($emp.employeeAgency=Null)
/* get employee agency
			* if emp is already managing one or several agencies => give him one of these agencies
			* If emp does no manage any agency, select a random one
			*/
			$managedAgencies:=ds.Agency.query("manager.ID = :1"; $emp.ID)
			If ($managedAgencies.length=0)
				$emp.employeeAgency:=$agencies[Random%$agencies.length]
			Else 
				$emp.employeeAgency:=$managedAgencies[Random%$managedAgencies.length]
			End if 
		End if 
		If ($emp.touched())
			$emp.save()
		End if 
	End for each 
	
shared Function generatePeople($howMany : Integer; $dataClass : Text)
	// This function is both used to generate customers and employees (dataclass)
	var $i : Integer
	var $fcount : Integer
	var $lcount : Integer
	var $acount : Integer
	var $rd : Integer
	var $firstnameList : Collection
	var $lastnameList : Collection
	var $addressList : Collection
	var $newEntity : 4D.Entity
	var $day : Integer
	var $month : Integer
	var $year : Integer
	var $monthdays : Integer
	var $firstDay : Date
	var $dateRoot : Text
	
	$firstnameList:=Split string(File("/RESOURCES/dataInit/firstnames.csv").getText("UTF-8"); "\n")
	$lastnameList:=Split string(File("/RESOURCES/dataInit/lastnames.csv").getText("UTF-8"); "\n")
	$fcount:=$firstnameList.length
	$lcount:=$lastnameList.length
	If ($dataClass="Customer")
		$addressList:=Split string(File("/RESOURCES/dataInit/addresses_20k.csv").getText("UTF-8"); "\n")
		$acount:=$addressList.length
	End if 
	
	For ($i; 1; $howMany)
		This.progress:=Round($i/$howMany*100; 0)
		$newEntity:=ds[$dataClass].new()
		$newEntity.firstname:=$firstnameList[(Random%$fcount)]
		$newEntity.lastname:=$lastnameList[(Random%$lcount)]
		$newEntity.phone:=This.randomPhone()
		$newEntity.mail:=Lowercase($newEntity.firstname)+"."+Lowercase($newEntity.lastname)+"@acme.qodlyrent.com"
		
		If ($dataClass="Customer")
			$newEntity.address:=String((Random%300)+1)+" "+$addressList[(Random%$acount)]
		End if 
		
		$year:=(Random%(2004-1940+1))+1940
		$month:=(Random%12)+1
		$dateRoot:=String($year)+"-"+($month<10 ? "0" : "")+String($month)
		$firstDay:=Date($dateRoot+"-01T00:00:00")
		$monthdays:=Add to date($firstDay; 0; 1; 0)-$firstDay
		$day:=(Random%$monthdays)+1
		$newEntity.birthdate:=Date($dateRoot+"-"+($day<10 ? "0" : "")+String($day)+"T00:00:00")
		$newEntity.save()
	End for 
	
shared Function generateData($params : Object)
	//Drop tables
	This.dropAllTables()
	
	This.running:=True
	This.task:="Generating data"
	This.progress:=0
	
	//Load tables
	This.subTask:="Step 1/20: Importing Agency Categories"
	This.genericCSVImport("CategoryAgency.csv"; "CategoryAgency"; ";")
	This.subTask:="Step 2/20: Importing Regions"
	This.genericCSVImport("Region.csv"; "Region"; ";")
	This.subTask:="Step 3/20: Importing Departments"
	This.genericCSVImport("Department.csv"; "Department"; ";")
	This.subTask:="Step 4/20: Importing Agencies"
	This.genericCSVImport("Agency.csv"; "Agency"; ";")
	This.subTask:="Step 5/20: Importing Car Categories"
	This.genericCSVImport("CategoryCar.csv"; "CategoryCar"; ";")
	This.subTask:="Step 6/20: Importing Defect Categories"
	This.genericCSVImport("DefectCategory.csv"; "DefectCategory"; ";")
	This.subTask:="Step 7/20: Importing Defective Elements"
	This.genericCSVImport("DefectiveElement.csv"; "DefectiveElement"; ";")
	This.subTask:="Step 8/20: Importing Option Categories"
	This.genericCSVImport("CategoryOption.csv"; "OptionCategory"; ";")
	This.subTask:="Step 9/20: Importing Statuses"
	This.genericCSVImport("Status.csv"; "Status"; ";")
	This.subTask:="Step 10/20: Importing Options"
	This.genericCSVImport("OptionAvailable.csv"; "OptionAvailable"; ";")
	This.subTask:="Step 11/20: Importing Colors"
	This.genericCSVImport("Colors.csv"; "Color"; ";")
	This.subTask:="Step 12/20: Importing Car Models"
	This.genericCSVImport("CarModel.csv"; "CarModel"; ";")
	
	This.subTask:="Step 13/20: Generating "+String($params.employees)+" employess"
	This.generatePeople($params.employees; "Employee")
	
	This.subTask:="Step 14/20: Generating "+String($params.customers)+" customers"
	This.generatePeople($params.customers; "Customer")
	
	//Load photos
	This.subTask:="Step 15/20: Loading option photos"
	This.loadOptionPhotos()
	This.subTask:="Step 16/20: Loading color photos"
	This.loadColorPhotos()
	This.subTask:="Step 17/20: Updating agencies"
	This.updateAgencies()
	This.subTask:="Step 18/20: Updating employees"
	This.updateEmployeesInfos()
	
	// Generate cars
	This.subTask:="Step 19/20: Generating "+String($params.nbCars)+" cars"
	This.createCars($params.nbCars; $params.nbPastDays)
	
	// Generate bookings
	This.subTask:="Step 20/20: Generating bookings"
	This.createBookings($params.nbDaysFuture)
	
	This.running:=False
	This.task:="idle"
	This.subTask:="none"
	This.progress:=100
	
shared Function dropAllTables()
	var $recordsCount : Integer
	var $droppedRecords : Integer
	var $tableName : Text
	var $tableLength : Integer
	
	$recordsCount:=0
	
	For each ($tableName; This.tablesToDrop)
		$recordsCount:=$recordsCount+ds[$tableName].all().length
	End for each 
	
	If (This.running=True)
		Web Form.setWarning("Cannot drop data, data process already running")
		return 
	End if 
	
	This.running:=True
	This.task:="Dropping table data"
	
	For each ($tableName; This.tablesToDrop)
		This.subTask:="Dropping "+$tableName+" table"
		$tableLength:=ds[$tableName].all().length
		This.dropAndResetTable($tableName)
		$droppedRecords:=$droppedRecords+$tableLength
		This.progress:=Round($droppedRecords/$recordsCount*100; 0)
	End for each 
	
	This.running:=False
	This.task:="idle"
	
Function workerGenerate($dataInit : cs.dataInitSingleton; $params : Object)
	$dataInit.generateData($params)
	
exposed Function generate($datasetSize : Text)
	var $nbCars : Integer
	var $nbPastDays : Integer
	var $nbDaysFuture : Integer
	var $params : Object
	
	If (This.running=True)
		Web Form.setWarning("Cannot generate data, data process already running")
		return 
	End if 
	
	Case of 
		: ($datasetSize="VeryBig")
			$params:={nbCars: 30000; nbPastDays: 365; nbDaysFuture: 365; customers: 100000; employees: 10000}
		: ($datasetSize="Big")
			$params:={nbCars: 25000; nbPastDays: 180; nbDaysFuture: 180; customers: 50000; employees: 5000}
		: ($datasetSize="Medium")
			$params:={nbCars: 10000; nbPastDays: 90; nbDaysFuture: 90; customers: 20000; employees: 2000}
		: ($datasetSize="Small")
			$params:={nbCars: 1000; nbPastDays: 45; nbDaysFuture: 45; customers: 20000; employees: 2000}
		Else   // Tiny
			$params:={nbCars: 200; nbPastDays: 30; nbDaysFuture: 30; customers: 10000; employees: 1000}
	End case 
	
	CALL WORKER("generateData"; This.workerGenerate; This; $params)