<?php
	require 'rb.php';
	R::setup('mysql:host=localhost; dbname=ymap','root','asdbogch');
    
    function addData($data) {
    	$mapData = R::dispense("mapdata");
    	if(isset($data['id']) && $data['id'] != 0) {
    		$mapData->id = $data['id'];
    	}
		$mapData->point = $data['point'];
		$mapData->poligon = $data['poligon'];
		$mapData->region = $data['region'];
		$mapData->address = $data['address'];
		$id = R::store( $mapData );
		if($id) {
			echo $id;
		}
		else {
			echo "0";
		}
    }

    function delData($id) {
    	$mapData = R::load('mapdata',$id);
    	R::trash($mapData); 
    }

    function getPolygon($id) {
    	$mapData = R::load('mapdata',$id);
    	echo $mapData->poligon;
    }

    function getData() {
    	$data = R::findAll('mapdata');
    	$result = array();
    	foreach ($data as $key => $value) {
    		$result[] = array(
    			'id' => $value->id,
    			'point' => $value->point,
    			'poligon' => $value->poligon,
    			'region' => $value->region,
    			'address' => $value->address
    		);
    	}
    	echo json_encode($result);
    }

    function saveCSV() {
    	$data = R::findAll('mapdata');
    	$result = array();
    	$f = fopen('php://memory', 'w'); 
    	foreach ($data as $key => $value) { 
    	    fputcsv($f, array(
    			$value->point,
    			$value->poligon,
    			$value->region,
    			$value->address
    		), ';'); 
    	}
    	fseek($f, 0);
    	header('Content-Type: application/csv');
    	header('Content-Disposition: attachement; filename="map.csv";');
    	fpassthru($f);
    }

    if(isset($_GET['do'])) {
    	switch ($_GET['do']) {
    		case 'save':
    			addData($_GET);
    			break;
    		case 'delete':
    			delData($_GET['id']);
    			break;
    		case 'get':
    			getData();
    			break;
    		case 'csv':
    			saveCSV();
    			break;
    		case 'getpolygon':
    			getPolygon($_GET['id']);
    	}
    }
