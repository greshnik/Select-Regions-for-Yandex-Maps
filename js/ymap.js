var map, myMap, dataMap, pointsCollection, placemarks = [], activePlaceMark;
var saveData = {
    'id': 0,
    'point': [],
    'polygon': [],
    'region': '',
    'address': ''
};
var drawButton, button;
var gCollection;
// Для рисования полигона
var pointsCollection,
    polyline;

// Для рисования произвольных фигур мышкой
var shapeMouse_coord_x = new Array(),
    shapeMouse_coord_y = new Array(),
    draw_area_array = [],
    draw = false,
    canvas, context, tool;
var kink = new Array(); // Параметр точности для алгоритма Дугласа Пьюкера. Зависит от параметра Zoom Яндекс.Карты
kink['5'] = 25500;
kink['6'] = 17500;
kink['7'] = 8500;
kink['8'] = 4400;
kink['9'] = 2200;
kink['10'] = 1000;
kink['11'] = 400;
kink['12'] = 250;
kink['13'] = 100;
kink['14'] = 50;
kink['15'] = 20;
kink['16'] = 10;
kink['17'] = 5;
var polygons_data = new Array(),
    line = [null, null, null],
    isShapeDrawingStarted = false;

var circleCoordBeforeDrag, pointRadiusResizer;
var isIE = false;
var ua = navigator.userAgent.toLowerCase();
var isAndroid = ua.indexOf("android") > -1; //&& ua.indexOf("mobile");

$(function() {

    //map.addControl(new HintPlace());
    //Hint('Начните рисовать участки или выберите один из районов');


    // Событие на нажатие на один из режимов рисования
    $('.map_info_list_draw_actions ul li').on('mousedown', function() {
        var
            type = $(this).attr('id'),
            activeType;

        $('.map_info_list_draw_actions ul li').each(function() {
            if ($(this).hasClass('active')) {
                var id = $(this).attr('id');
                activeType = id;
                if (id == 'draw_poly_action') resetPolygonDrawing();
                else if (id == 'draw_shape_action') resetShapeDrawing();
                else if (id == 'draw_circle_action') resetCircleDrawing();
            }
            $(this).removeClass('active');
        });

        if (type != activeType) {
            switch (type) {
                case 'draw_poly_action':
                    drawPolygon();
                    break;
                case 'draw_shape_action':
                    drawShape();
                    break;
                case 'draw_circle_action':
                    drawCircle();
                    break;
                default:
                    return;
                    break;
            }

            $(this).addClass('active');
        }
    });

    $('.map_info_clear ul').on('click', 'li', function() {
        gCollection.removeAll();
        if (typeof pointRadiusResizer != 'undefined') map.geoObjects.remove(pointRadiusResizer);
        CursorHint.hide();
    });
    //$('.map_info_list_draw_actions ul li').on('touchstart', function(){console.log('touchstart');});

    $('.map_info_list_draw_actions ul li').on('mousemove', function(e) {
        CursorHint.show($(this).val(), e);
    });

    $('.map_info_list_draw_actions ul li').on('mouseleave', function() {
        CursorHint.hide();
    });

    if (!isCanvasSupported) {
        $('#draw_shape_action').hide();
        $('.map_info_list_draw_actions').css('paddingLeft', '15px');
    } else {
        fitCanvas();
    }
});

function UpdateClearButton() {
    var count = gCollection.getLength();
    if (count > 0)
        $('.map_info_clear ul li').find('span').html('Очистить все (' + count + ')');
    else {
        $('.map_info_clear ul li').find('span').html('Очистить все');
        Hint('Начните рисовать участки или выберите один из районов');
    }
}

function undoColorPlacemark() {
    // placemarks.forEach(function(item, index) {
    //     item.options.set('iconColor', item.lastColor);
    // });
    if(activePlaceMark) {
        activePlaceMark.options.set('iconColor', activePlaceMark.lastColor);
    }
}

function mapFunctions() {
    myMap.events.add('click', function (e) {
        var coords = e.get('coords');
        var placemark = new ymaps.Placemark(coords, {}, {
            balloonCloseButton: false,
            hideIconOnBalloonOpen: false
        });
        placemark.lastColor = 'blue';
        placemarks.push(placemark);

        placemark.events.add('click', function () {
            undoColorPlacemark();
            activePlaceMark = placemark;
            saveData.id = 0;
            saveData.point = coords;
            saveData.region = $('#region-data').val();
            ymaps.geocode(coords).then(function (res) {
                var names = [];
                res.geoObjects.each(function (obj) {
                    names.push(obj.properties.get('name'));
                });
                // console.log(names);
                if(names.length > 4) {
                    saveData.address = names[4]+', '+names[1];
                }
                else {
                    saveData.address = names[1]+', '+names[0];
                }
            });
            map.setCenter(coords);
            placemark.options.set('iconColor', 'red');
            gCollection.removeAll();
            if (typeof pointRadiusResizer != 'undefined') map.geoObjects.remove(pointRadiusResizer);
            CursorHint.hide();
            $.ajax({
                url: '/back.php',
                data: {
                  'do': 'getpolygon',
                  'id': placemark.id
                },
                success: function(res) {
                    addPolygonOnMap([JSON.parse(res)], 'polygon');
                    resetShapeDrawing();
                }
            });
        });
        placemark.events.add('dblclick', function () {
            placemark.options.set("visible", false);
        });
        placemark.options.set('iconColor', 'blue');
        myMap.geoObjects.add(placemark);
    });
}

function loadData(){
    $.ajax({
      url: '/back.php',
      data: {
        'do': 'get'
      },
      success: function(res) {
        dataMap = JSON.parse(res);
        dataMap.forEach(function(item, index){
            var placemark = new ymaps.Placemark(JSON.parse(item.point), {}, {
                balloonCloseButton: false,
                hideIconOnBalloonOpen: false
            });
            placemark.id = item.id;
            placemark.lastColor = 'green';
            placemarks.push(placemark);

            placemark.events.add('click', function () {
                undoColorPlacemark();
                activePlaceMark = placemark;
                saveData.id = item.id;
                saveData.point = JSON.parse(item.point);
                saveData.region = $('#region-data').val();
                ymaps.geocode(JSON.parse(item.point)).then(function (res) {
                    var names = [];
                    res.geoObjects.each(function (obj) {
                        names.push(obj.properties.get('name'));
                    });
                    if(names.length > 4) {
                        saveData.address = names[4]+', '+names[1];
                    }
                    else {
                        saveData.address = names[1]+', '+names[0];
                    }
                });
                map.setCenter(JSON.parse(item.point));
                placemark.options.set('iconColor', 'red');
                gCollection.removeAll();
                if (typeof pointRadiusResizer != 'undefined') map.geoObjects.remove(pointRadiusResizer);
                CursorHint.hide();
                $.ajax({
                    url: '/back.php',
                    data: {
                      'do': 'getpolygon',
                      'id': placemark.id
                    },
                    success: function(res) {
                        addPolygonOnMap([JSON.parse(res)], 'polygon');
                        resetShapeDrawing();
                    }
                });
            });
            placemark.options.set('iconColor', 'green');
            myMap.geoObjects.add(placemark);
            $('#result').append('<tr><td>'+item.point+'</td><td style="font-size: 10px;">'+item.poligon+'</td><td>'+item.region+'</td><td>'+item.address+'</td><td><a href="" class="del" data-id="'+item.id+'"><span class="glyphicon glyphicon-remove" aria-hidden="true"></span></a></td></tr>');
        });
      }
    });
}

function mapInit(lng, lat, fCallback) {
    myMap = new ymaps.Map('map', {
        center: [55.76, 37.64], // Москва
        zoom: 9
    });
    myMap.controls
        .remove('mapTools')
        .remove('zoomControl')
        .remove('scaleLine')
        .remove('searchControl')
        .remove('trafficControl')
        .remove('typeSelector');
    myMap.behaviors.disable('scrollZoom');
    myMap.behaviors.disable('dblClickZoom');
    mapFunctions();
    loadData();

    $('#load-region').click(function(){
        var myGeocoder = ymaps.geocode($('#region-data').val());
        myGeocoder.then(
            function (res) {
                myMap.setCenter(res.geoObjects.get(0).geometry.getCoordinates());
            },
            function (err) {
                alert('Ошибка');
            }
        );
    });

    map = new ymaps.Map('map2', {
        center: [55.76, 37.64], // Москва
        zoom: 10
    });

    //Кнопка вкл\откл подсказок рядом с курсором
    // var buttonCursorHint = new ymaps.control.Button({
    //         data : {
    //             image : 'http://cian.ru/nd/search/global/cursor_hint_unselected.png',
    //             content : '<span style="font: 13px Arial, sans-serif; float: left; margin: 8px 4px 0 3px;">Подсказки</span>',
    //             title : 'Подсказки рядом с курсором при рисовании',
    //             imageSelected: 'http://cian.ru/nd/search/global/cursor_hint.png'
    //         }
    //     },
    //     {
    //         selectOnClick: true,
    //         name: 'cursor_hint_activator'
    //     });

    // buttonCursorHint.select();

    // buttonCursorHint.events.add('click', function (e) { 
    //     if(buttonCursorHint.isSelected()) {     //если кнопка нажата                 

    //     }
    // }); 

    map.controls.add("zoomControl");
    //map.controls.add(buttonCursorHint, {top: 5, left: 98});       

    gCollection = new ymaps.GeoObjectCollection();

    // Событие на удаление объекта из коллекции
    gCollection.events.add('remove', function(e) {
        var id = draw_type = e.get('child').properties.get('id'),
            draw_type = e.get('child').properties.get('draw_type');
        if (draw_type == 'district') {
            $('.map_info_list_districts ul li[rel=' + id + ']').removeClass('selected').removeClass('over').find('i').removeClass('selected');
            $('.map_info_list_districts ul li[rel=' + id + ']').find('span').css('border-bottom', '1px dotted #777');
        }
        $('input[type=hidden][rel=' + id + ']').remove();
        UpdateClearButton();
    });

    // Событие на добавление объекта в коллекцию
    gCollection.events.add('add', function(e) {

        var id = e.get('child').properties.get('id'),
            draw_type = e.get('child').properties.get('draw_type'),
            geometry_str = e.get('child').geometry.getCoordinates().toString();

        if (draw_type == 'district') {
            $('.map_info_list_districts ul li[rel=' + id + ']').addClass('selected').find('i').addClass('selected');
            $('.map_info_list_districts ul li[rel=' + id + ']').find('span').css('border-bottom', 'none');
        }

        switch (draw_type) {
            case 'polygon':
                container_id = 'drawn_geometry_polygons';
                name = 'in_polygon[]';
                break;
            case 'shape':
                container_id = 'drawn_geometry_shapes';
                name = 'in_polygon[]';
                break;
            case 'circle':
                container_id = 'drawn_geometry_circles';
                name = 'distance[]';
                geometry_str += ',' + e.get('child').geometry.getRadius();
                break;
            case 'district':
                container_id = 'drawn_geometry_districts';
                name = 'in_polygon[]';
                break;
        }
        $('#drawn_geometry')
            .find('#' + container_id)
            .append('<input type="hidden" rel="' + id + '" name="' + name + '" value="' + geometry_str + '"/>');

        UpdateClearButton();
    });

    // Событие на двойной клик по объекту в коллекции
    gCollection.events.add('dblclick', function(e) {
        var id = e.get('target').properties.get('id'),
            draw_type = e.get('target').properties.get('draw_type');
        //console.log(id);
        gCollection.each(function(obj) {
            if (obj.properties.get('id') == id) {
                gCollection.remove(obj);
                if (draw_type == 'district') {
                    $('.map_info_list_districts ul li[rel=' + id + ']').removeClass('selected').removeClass('over').find('i').removeClass('selected');
                    $('.map_info_list_districts ul li[rel=' + id + ']').find('span').css('border-bottom', '1px dotted #777');
                }
                if (draw_type == 'circle') {
                    var circleCount = 0;
                    gCollection.each(function(obj) {
                        if (obj.properties.get('draw_type') == 'circle') circleCount++;
                    });

                    // Если был удален последний круг
                    if (circleCount < 1) map.geoObjects.remove(pointRadiusResizer);
                    else pointRadiusResizer.options.set({
                        visible: false
                    });
                }
            }
        });
        CursorHint.hide();
        UpdateClearButton();
    });

    // Событие при наведении курсора на объект в коллекции
    gCollection.events.add('mouseenter', function(e) {
        var id = e.get('target').properties.get('id'),
            draw_type = e.get('target').properties.get('draw_type');
        //      if (draw_type == 'district') Hint('Два клика - удалить');
        //      else Hint('Один клик - редактировать<br>Два клика - удалить');

        gCollection.each(function(obj) {
            if (obj.properties.get('id') == id) {
                obj.options.set({
                    opacity: 0.8
                });
            }
        });
    });

    // Событие при выводе курсора за пределы объекта в коллекции
    gCollection.events.add('mouseleave', function(e) {
        var id = e.get('target').properties.get('id'),
            draw_type = e.get('target').properties.get('draw_type');
        //Hint('Начните рисовать участки или выберите один из районов');
        CursorHint.hide();
        gCollection.each(function(obj) {
            if (obj.properties.get('id') == id) {
                obj.options.set({
                    opacity: 0.5
                });
            }
        });
        //console.log('MouseLeave');    
    });

    // Событие при выводе курсора за пределы объекта в коллекции
    gCollection.events.add('mousemove', function(e) {
        var id = e.get('target').properties.get('id'),
            draw_type = e.get('target').properties.get('draw_type');

        if (draw_type == 'district') CursorHint.show('<b>' + e.get('target').properties.get('hintContent') + ' район</b> <br>Два клика - удалить', e);
        else CursorHint.show('Один клик - редактировать<br>Два клика - удалить', e);
    });

    gCollection.events.add('dragend', function(e) {
        var id = e.get('target').properties.get('id'),
            isCircle = e.get('target') instanceof ymaps.Circle;;
        $('input[type=hidden][rel=' + id + ']').val(e.get('target').geometry.getCoordinates() + (isCircle ? ',' + e.get('target').geometry.getRadius() : ''));
    });


    map.geoObjects.add(gCollection);

    if (fCallback) fCallback();

    fitCanvas();
}


/****************************************/
/* РИСОВАНИЕ ПОЛИГОНОВ ПО ТОЧКАМ        */
/****************************************/

// События карты и точек для рисования полигона по точкам
var mapTouchStart = function(e) {
        e.preventDefault();
        alert('mapTouchStart');
    },

    mapClickEventPolygon = function(e) {
        var coord = e.get('position'),
            mousePoint = e.get('coordPosition'),
            vertexCount = pointsCollection.getLength(),
            lastPointCoord, penultimatePointCoord, i = 0;
        //$('.map_info_title').html(window.pageYOffset);    
        //$('.map_info_title').html('coord = '+coord[1]+' new = '+(coord[1] - $('#YMapsID').offset().top));
        //alert();
        //  if (isAndroid){
        //      var globalPixelPoint = map.converter.pageToGlobal([coord[0], coord[1] + $('#YMapsID').offset().top]);
        //      mousePoint = map.options.get('projection').fromGlobalPixels(globalPixelPoint, map.getZoom());
        //  }
        //$('.map_info_title').html(e.originalEvent.domEvent.originalEvent.touches[0].pageY);
        //event.touches[0].pageY - Math.round(offset.top)
        if (vertexCount == 0) {
            var pointProperties = {
                    id: 'startPoint'
                },
                pointOptions = {
                    iconImageHref: bIsMobileView ? 'global/pin_start_touch_big.png' : '../global/pin_start.png', // картинка иконки
                    iconImageSize: bIsMobileView ? [32, 32] : [16, 16], // размеры картинки
                    iconImageOffset: bIsMobileView ? [-16, -16] : [-8, -8], // смещение картинки,
                    iconContentPadding: 40
                };
        } else {
            var pointProperties = {},
                pointOptions = {
                    iconImageHref: '../global/pin.png', // картинка иконки
                    iconImageSize: [16, 16], // размеры картинки
                    iconImageOffset: [-8, -8] // смещение картинки
                };
        }
        // Задаем точку - это угол рисуемого полигона
        placemark = new ymaps.Placemark(mousePoint, pointProperties, pointOptions);
        // Добавляем ее в коллекцию
        pointsCollection.add(placemark);

        // Вычисляем координаты последней и предпоследней точек (углов полигона), находящихся в коллекции
        if (isIE || bIsMobileView) {
            if (pointsCollection.getLength() > 1) {
                pointsCollection.each(function(obj) {
                    if (i == (vertexCount - 1)) penultimatePointCoord = obj.geometry.getCoordinates();
                    if (i == (vertexCount)) lastPointCoord = obj.geometry.getCoordinates();
                    i++;
                });

                //document.title = penultimatePointCoord;
                // Линия, которая пока остается на карте. Соединяет две точки между собой
                //var stayedPolyline = new ymaps.Polyline([penultimatePointCoord, lastPointCoord]);
                map.geoObjects.add(new ymaps.Polyline([penultimatePointCoord, lastPointCoord], {
                    id: 'stayedPolyline'
                }, {
                    strokeColor: '#f7583f',
                    strokeWidth: 2
                }));
            }
        }
        //  if (vertexCount > 3) Hint('Продолжайте ставить точки или закончите область, нажав на первую точку')
        //  else Hint('Продолжайте ставить точки');

    },

    mapMouseMoveEventPolygon = function(e) {
        //map.geoObjects.remove(polyline);

        if (pointsCollection.getLength() > 0) {
            var coord = e.get('position'),
                mousePoint = e.get('coordPosition'),
                vertexCount = pointsCollection.getLength(),
                i = 0,
                lastPointCoord;
            CursorHint.show(vertexCount < 3 ? 'Продолжайте ставить точки' : 'Продолжайте ставить точки или закончите область, нажав на первую точку', e);
            // Координаты последней поставленной на карте точки
            pointsCollection.each(function(obj) {
                if (i == (vertexCount - 1)) lastPointCoord = obj.geometry.getCoordinates();
                i++;
            });

            // Линия, один конец которой будет привязан к последней точке, а другой к указателю мыши
            map.geoObjects.remove(polyline);
            polyline = new ymaps.Polyline([lastPointCoord, mousePoint], {}, {
                strokeColor: '#f7583f',
                strokeWidth: 2
            });
            polyline.events.add('click', function(e) {
                var coord = e.get('position'),
                    mousePoint = e.get('coordPosition'),
                    vertexCount = pointsCollection.getLength(),
                    lastPointCoord, penultimatePointCoord, i = 0;

                // Добавляем точку (вершину полигона) в коллекцию
                placemark = new ymaps.Placemark(mousePoint, {}, {
                    iconImageHref: '../global/pin.png', // картинка иконки
                    iconImageSize: [16, 16], // размеры картинки
                    iconImageOffset: [-8, -8] // смещение картинки
                });
                pointsCollection.add(placemark);

                // Вычисляем координаты последней и предпоследней точки для того, чтобы соединить их линией
                if (pointsCollection.getLength() > 1) {
                    pointsCollection.each(function(obj) {
                        if (i == (vertexCount - 1)) penultimatePointCoord = obj.geometry.getCoordinates();
                        if (i == (vertexCount)) lastPointCoord = obj.geometry.getCoordinates();
                        i++;
                    });

                    // Соединительная линия, которая остается на карте и не передвигается вслед за мышкой
                    map.geoObjects.add(new ymaps.Polyline([penultimatePointCoord, lastPointCoord], {
                        id: 'stayedPolyline'
                    }, {
                        strokeColor: '#f7583f',
                        strokeWidth: 2
                    }));
                }
                if (vertexCount > 2) Hint('Продолжайте ставить точки или закончите область, нажав на первую точку')
                else Hint('Продолжайте ставить точки');
            });


            map.geoObjects.add(polyline);
        } else {
            CursorHint.show('Нажмите на карту, чтобы поставить первую точку', e);
        }
    },

    pointsCollectionClickEventPolygon = function(e) {
        //console.log(e.get('target').properties.get('id'));
        var id = e.get('target').properties.get('id'),
            vertexCount = pointsCollection.getLength();
        if (id == 'startPoint' && vertexCount > 2) {
            var geometry = new Array();
            //alert('Начальная точка! Полигон завершен!');
            // Перебираем все проставленные точки и собираем из их координат координаты вершин полигона
            pointsCollection.each(function(obj) {
                geometry.push(obj.geometry.getCoordinates());
            });
            // Отображаем полигон на карте
            addPolygonOnMap([geometry], 'polygon');

            resetPolygonDrawing();
        }
    },

    drawnPolygonEventsClick = function(e) {
        var id = e.get('target').properties.get('id'),
            draw_type = e.get('target').properties.get('draw_type');
        //console.log(id);
        //console.log(draw_type);
        //StopEditingGeoObjects();
        // Для нарисованного полигона переключаем режим редактирования
        gCollection.each(function(obj) {
            if ((draw_type == 'polygon' || draw_type == 'shape') && obj.properties.get('id') == id) {
                //console.log(obj.editor.state.get('editing'));
                if (obj.editor.state.get('editing') == true) obj.editor.stopEditing();
                else obj.editor.startEditing();
            } else {
                if (obj.properties.get('draw_type') == 'circle') {
                    if (typeof pointRadiusResizer.options.get('visible') == 'undefined' || pointRadiusResizer.options.get('visible') == true) {
                        pointRadiusResizer.options.set({
                            visible: false
                        });
                    }
                } else
                    obj.editor.stopEditing();

            }
        });
    },

    drawnPolygonEventsGeometryChange = function(e) {
        var temp = e.get('target').geometry.getCoordinates();
        saveData.polygon = temp[0];
        var id = e.get('target').properties.get('id');
        $('input[type=hidden][rel=' + id + ']').val(e.get('target').geometry.getCoordinates());
    };

/*******************************************/
/* ФУНКЦИИ ДЛЯ РИСОВАНИЯ КРУГА             */
/*******************************************/
var mapEventsClickCircle = function(e, exact_geometry) {

        if (e !== null) {
            var
                coord = e.get('position'),
                ieY = isIE ? e.get('position')[1] : 0,
                iePointCircleCenter = map
                .options
                .get('projection')
                .fromGlobalPixels(map.converter.pageToGlobal([coord[0], ieY]), map.getZoom());
        }

        var pointCircleCenter = (typeof exact_geometry === 'undefined' ? (isIE ? iePointCircleCenter : e.get('coordPosition')) : [exact_geometry[0], exact_geometry[1]]),
            //optimalRadius = map.getZoom() * 1000,
            id_circle = randomID('circle_'),
            atListOneCircleExist = false;

        var circle = new ymaps.Circle([pointCircleCenter, (typeof exact_geometry === 'undefined' ? getOptimalRadius() : exact_geometry[2])], {
            id: id_circle,
            draw_type: 'circle',
            hintContent: 'Радиус круга - ' + (typeof exact_geometry === 'undefined' ? getOptimalRadius() + ' м.' : exact_geometry[2] + ' м.')
        }, {
            strokeColor: '#ff0000',
            fillColor: '#6699ff',
            strokeWidth: 2,
            opacity: 0.5,
            geodesic: true,
            draggable: true
        });

        circle.events.add('click', function(e) {
            var id = e.get('target').properties.get('id');


            if (pointRadiusResizer.properties.get('circle_id') == id) {
                if (typeof pointRadiusResizer.options.get('visible') == 'undefined' || pointRadiusResizer.options.get('visible') == true) {
                    pointRadiusResizer.options.set({
                        visible: false
                    });
                } else {
                    StopEditingGeoObjects();
                    pointRadiusResizer.options.set({
                        visible: true
                    });
                }
            } else {
                // Координаты для ресайзера
                var circleCenterCoord = e.get('target').geometry.getCoordinates(),
                    bounds = e.get('target').geometry.getBounds();
                StopEditingGeoObjects();
                var point_radius_resizer_x = bounds[0].toString();
                point_radius_resizer_x = point_radius_resizer_x.split(',');
                point_radius_resizer_x = point_radius_resizer_x[0];

                var point_radius_resizer_y = circleCenterCoord.toString();
                point_radius_resizer_y = point_radius_resizer_y.split(',');
                point_radius_resizer_y = point_radius_resizer_y[1];

                pointRadiusResizer.geometry.setCoordinates([point_radius_resizer_x, point_radius_resizer_y]);
                pointRadiusResizer.properties.set({
                    circle_id: id
                });
                pointRadiusResizer.options.set({
                    visible: true
                });

            }


        });

        circle.events.add('dragstart', circleEventDragStart);
        circle.events.add('dragend', circleEventDragEnd);
        circle.events.add('geometrychange', circleEventGeometryChange);

        // Проверяем есть ли хотя бы один круг на карте
        gCollection.each(function(obj) {
            if (obj.properties.get('draw_type') == 'circle') atListOneCircleExist = true;
        });

        gCollection.add(circle);




        $('#draw_circle_action').removeClass('active');

        // Координаты для ресайзера
        var point_radius_resizer_x = circle.geometry.getBounds()[0].toString();
        point_radius_resizer_x = point_radius_resizer_x.split(',');
        point_radius_resizer_x = point_radius_resizer_x[0];

        var point_radius_resizer_y = circle.geometry.getCoordinates().toString();
        point_radius_resizer_y = point_radius_resizer_y.split(',');
        point_radius_resizer_y = point_radius_resizer_y[1];

        // Проверяем есть ли хотя бы один круг на карте. Если есть, то просто назначаем новые координаты точке-ресайзеру,
        // если нет  - создаем эту точку с новыми координатами
        if (atListOneCircleExist) {
            //console.log(e);
            StopEditingGeoObjects();
            pointRadiusResizer.geometry.setCoordinates([point_radius_resizer_x, point_radius_resizer_y]);
            pointRadiusResizer.properties.set({
                circle_id: id_circle
            });
            pointRadiusResizer.options.set({
                visible: true
            });
        } else {
            //   Создаем точку-ресайзер
            pointRadiusResizer = new ymaps.Placemark([point_radius_resizer_x, point_radius_resizer_y], {
                circle_id: id_circle,
                draw_type: 'circle_resizer',
                hintContent: 'Перетащите, чтобы изменить радиус круга'
            }, {
                draggable: true,
                visible: true,
                iconImageHref: '../global/pin.png', // картинка иконки
                iconImageSize: [16, 16], // размеры картинки
                iconImageOffset: [-8, -8] // смещение картинки
            });
            pointRadiusResizer.events.add('drag', function(e) {
                var circle_id = e.get('target').properties.get('circle_id');
                gCollection.each(function(obj) {
                    if (obj.properties.get('draw_type') == 'circle' && obj.properties.get('id') == circle_id) {
                        var radius = Math.floor(DistanceBetweenTwoPoints(e.get('target').geometry.getCoordinates(), obj.geometry.getCoordinates()) * 1000);
                        //console.log(radius);
                        obj.geometry.setRadius(radius);
                        obj.properties.set({
                            hintContent: 'Радиус круга - ' + radius + ' м.'
                        });
                        pointRadiusResizer.properties.set({
                            hintContent: 'Радиус круга - ' + radius + ' м.<br>Перетащите, чтобы изменить'
                        });
                        //cursorHint('ttt');
                        CursorHint.show('Радиус круга - ' + radius + ' м.', e);

                    }
                });
            });
            pointRadiusResizer.events.add('dragend', function(e) {
                CursorHint.hide();
            });
            pointRadiusResizer.events.add('mouseenter', function(e) {
                Hint('Перетащите, чтобы изменить радиус круга');
            });
            pointRadiusResizer.events.add('mouseleave', function(e) {
                Hint('Начните рисовать участки или выберите один из районов');
            });
            map.geoObjects.add(pointRadiusResizer);
        }


        map.events.remove('click', mapEventsClickCircle);
        map.events.remove('mousemove', mapEventsMouseMoveCircle);
        //console.log(getOptimalRadius());
        map.cursors.push('arrow');
    },

    mapEventsMouseMoveCircle = function(e) {
        CursorHint.show('Нажмите на карте, чтобы разместить круг. Затем вы сможете изменить его радиус', e);
    },

    circleEventDragStart = function(e) {
        circleCoordBeforeDrag = e.get('target').geometry.getCoordinates();
        // Скрываем перед перетаскиванием круга точку-ресайзер
        pointRadiusResizer.options.set({
            visible: false
        });
        //console.log(pointRadiusResizer);
    },

    circleEventDragEnd = function(e) {
        var id = e.get('target').properties.get('id');

        if (pointRadiusResizer.properties.get('circle_id') == id) {
            // Координаты центра круга после перемещения
            var circleCenterCoord = e.get('target').geometry.getCoordinates(),
                // Разница в координатах центра круга после перетаскивания
                coord_shift_x = circleCenterCoord[0] - circleCoordBeforeDrag[0],
                coord_shift_y = circleCenterCoord[1] - circleCoordBeforeDrag[1];
            // Запоминаем координаты точки-ресайзера    
            var pointResizerOldCoord = pointRadiusResizer.geometry.getCoordinates()[0];

            // Получаем новые координаты точки ресайзера
            var newResizerCoord = [
                parseFloat(pointRadiusResizer.geometry.getCoordinates()[0]) + parseFloat(coord_shift_x),
                parseFloat(pointRadiusResizer.geometry.getCoordinates()[1]) + parseFloat(coord_shift_y)
            ];

            pointRadiusResizer.geometry.setCoordinates(newResizerCoord);
            pointRadiusResizer.options.set({
                visible: true
            });
        }


    },

    circleEventGeometryChange = function(e) {
        var id = e.get('target').properties.get('id');
        $('input[rel=' + id + ']').val(e.get('target').geometry.getCoordinates() + ',' + e.get('target').geometry.getRadius());
    }


function drawPolygon() {
    if ($.browser.msie) isIE = true;
    $('.map_info_list_draw_actions ul li').removeClass('active');
    $('#draw_poly_action').addClass('active');
    StopEditingGeoObjects();
    pointsCollection = new ymaps.GeoObjectCollection();
    map.geoObjects.add(pointsCollection);
    pointsCollection.events.add('click', pointsCollectionClickEventPolygon);
    // Это временная линия, которая соединяет последнюю поставленную точку и курсор мыши
    polyline = new ymaps.Polyline();
    map.geoObjects.add(polyline);
    map.events.add('click', mapClickEventPolygon);
    //map.events.add('multitouchstart', mapTouchStart);
    if (!bIsMobileView) {
        map.events.add('mousemove', mapMouseMoveEventPolygon);
    }
    Hint('Нажмите на карту, чтобы поставить точку');

}

// Добавление полигона на карту
function addPolygonOnMap(geometry, draw_type) {
    saveData.polygon = geometry[0];
    var
        properties = {
            id: randomID(draw_type + '_'),
            draw_type: draw_type
        },
        options = {
            //          interactivityModel: 'default#layer',
            fill: true,
            draggable: true,
            cursor: 'move',
            strokeColor: '#ff0000',
            fillColor: '#6699ff',
            strokeWidth: 2,
            opacity: 0.5
        },
        drawnPolygon = new ymaps.Polygon(geometry, properties, options)
    drawnPolygon.events.add('click', drawnPolygonEventsClick);
    drawnPolygon.events.add('geometrychange', drawnPolygonEventsGeometryChange);


    // Определяем внешний вид вершин полигона 
    var vertexLayout = ymaps.templateLayoutFactory.createClass('<div class="polygon_vertex"></div>');
    drawnPolygon.editor.options.set({
        vertexLayout: vertexLayout
    });
    gCollection.add(drawnPolygon);
    // Сначала выключаем у всех фигур на карте режим редактирования
    StopEditingGeoObjects();
    drawnPolygon.editor.startEditing();
    //Hint('Начните рисовать участки или выберите один из районов');
    $('#draw_poly_action').removeClass('active');
    CursorHint.hide();

}

function randomID(prefix) {
    var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
    var string_length = 8;
    var randomstring = '';
    for (var i = 0; i < string_length; i++) {
        var rnum = Math.floor(Math.random() * chars.length);
        randomstring += chars.substring(rnum, rnum + 1);
    }
    prefix = typeof prefix !== 'undefined' ? prefix : '';
    return prefix + randomstring;
}

/*************************************************/
/*  КОНЕЦ. РИСОВАНИЕ ПОЛИГОНОВ ПО ТОЧКАМ. КОНЕЦ. */
/*************************************************/

// Ищем по выделенным участкам карты на ЦИАНе
function SendParamsToCian(deal_type) {
    var count = gCollection.length();
    var in_polygon_str = '';
    if (count < 1) {
        alert('Выделите хотя бы один участок на карте');
    } else {
        for (var i = 0; i < count; i++) {
            // Составляем строку с параметрами (координатами) для каждого полигона
            in_polygon_str += '&in_polygon[' + i + ']=' + gCollection.get(i).getPoints().toString();
        }
        // Формируем URL с параметрами - координатами полигонов и типом сделки (аренда, продажа)
        var url = "http://www.cian.ru/cat.php?deal_type=" + (deal_type ? deal_type : '1') + in_polygon_str;
        // Открываем ЦИАН с поиском по нарисованным на карте областям
        OpenWindowsWithPost(url);
    }
}

// Функция для открытия нового окна с POST-параметрами
function OpenWindowsWithPost(url) {
    var host = url.slice(0, url.indexOf('?'));
    var param_str = url.slice(url.indexOf('?') + 1, url.length);
    var params = param_str.split('&');
    if (params.length > 0) {
        var form = document.createElement("form");
        form.setAttribute("method", "post");
        form.setAttribute("action", host);
        form.setAttribute("target", "_blank");
        form.setAttribute("hidden", "hidden");
        for (var i = 0; i < params.length; i++) {
            var param_pair = params[i].split('=');
            var hiddenField = document.createElement("input");
            hiddenField.setAttribute("name", param_pair[0]);
            hiddenField.setAttribute("value", param_pair[1]);
            hiddenField.setAttribute("hidden", "hidden");
            form.appendChild(hiddenField);
        }
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
    }

}

function isCanvasSupported() {
    var elem = document.createElement('canvas');
    return !!(elem.getContext && elem.getContext('2d'));
}

//************************************************

// Функция кодирования точек ломанной
function encodePoints(points) {

    var array = [], // Временный массив для точек
        prev = new ymaps.geometry.Point([0, 0]), // Предыдущая точка
        coef = 1000000; // Коэффициент

    // Обработка точек
    for (var i = 0, geoVector, currentPoint; i < points.length; i++) {
        //currentPoint = points[i].copy();
        currentPoint = points[i];
        // Нахождение смещение относительно предыдущей точки
        geoVector = currentPoint.diff(prev).neg();
        // Умножение каждой координаты точки на коэффициент и кодирование
        array = array.concat(Base64.encode4bytes(geoVector.getX() * coef), Base64.encode4bytes(geoVector.getY() * coef));
        prev = currentPoint;
    }
    // Весь массив кодируется в Base64
    return Base64.encode(array);
}
// Класс для работы с Base64
// За основу взят класс с http://www.webtoolkit.info/
var Base64 = new function() {
    var _keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_=";
    this.encode4bytes = function(x) {
        var chr = [];
        for (var i = 0; i < 4; i++) {
            chr[i] = x & 0x000000ff;
            x = x >> 8;
        }
        return chr;
    };



    this.encode = function(input) {
        var output = "",
            chr1, chr2, chr3, enc1, enc2, enc3, enc4,
            i = 0,
            inputIsString = typeof input == "string";
        while (i < input.length) {
            chr1 = input[i++];
            chr2 = input[i++];
            chr3 = input[i++];
            enc1 = chr1 >> 2;
            enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
            enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
            enc4 = chr3 & 63;

            if (isNaN(chr2)) {
                enc3 = enc4 = 64;
            } else if (isNaN(chr3)) {
                enc4 = 64;
            }

            output +=
                _keyStr.charAt(enc1) + _keyStr.charAt(enc2) +
                _keyStr.charAt(enc3) + _keyStr.charAt(enc4);
        }
        return output;
    };
};

function StopEditingGeoObjects() {
    //console.log('Stop Editing');
    gCollection.each(function(obj) {
        if (obj.properties.get('draw_type') == 'polygon' || obj.properties.get('draw_type') == 'shape')
            if (obj.editor.state.get('editing') == true) obj.editor.stopEditing();
            //console.log(obj.properties.get('draw_type')+' = '+ obj.editor.state._data.editing)    
    });
    if (typeof pointRadiusResizer != 'undefined') {
        if (typeof pointRadiusResizer.options.get('visible') == 'undefined' || pointRadiusResizer.options.get('visible') == true) {
            pointRadiusResizer.options.set({
                visible: false
            });
        }
    }
}



function getOptimalRadius() {
    var bounds = map.getBounds(),
        leftBottomPoint = bounds[0],
        leftTopPoint = [leftBottomPoint[0], bounds[1][1]],
        height = Math.floor(DistanceBetweenTwoPoints(leftBottomPoint, leftTopPoint));

    return height / 5 * 1000;

}


/**************************************************/
/* РИСОВАНИЕ ПРОИЗОВЛЬНЫХ ФИГУР МЫШКОЙ            */
/**************************************************/
function drawShape() {
    //if ($.browser.msie) isIE = true;
    isIE = false;
    fitCanvas();
    canvas = document.getElementById('drawing-area');
    if (!canvas) {
        alert('Ошибка: отсутствует canvas-элемент!');
        return;
    }

    if (!canvas.getContext) {
        alert('Ошибка: отсутствует canvas.getContext!');
        return;
    }

    context = canvas.getContext('2d');
    if (!context) {
        alert('Ошибка: нет доступа к getContext!');
        return;
    }
    $('#drawing-area').css('display', 'block');
    isShapeDrawingStarted = false;
    //tool = new tool_pencil();

    // Прикрепляем события мыши и Touch-эвентов к Canvas
    if (canvas.addEventListener) {
        //if (!bIsMobileView){
        canvas.addEventListener('mousedown', touchPreDraw, false);
        canvas.addEventListener('mousemove', touchDraw, false);
        canvas.addEventListener('mouseup', touchEndDraw, false);
        canvas.addEventListener('mouseleave', touchEndDraw, false);
        // } 
        // else {
        //     canvas.addEventListener('touchstart', touchPreDraw, false);
        //     canvas.addEventListener('touchmove', touchDraw, false);
        //     canvas.addEventListener('touchend', touchEndDraw, false); 
        // }

    } else if (canvas.attachEvent) { // IE
        canvas.attachEvent("onmousedown", touchPreDraw);
        canvas.attachEvent("onmousemove", touchDraw);
        canvas.attachEvent("onmouseleave", touchEndDraw);
    }
    //window.addEventListener('touchmove', windowTouchMove, false);
    //Hint('Нажмите на карту и нарисуйте область');
    StopEditingGeoObjects();
    $('.map_info_list_draw_actions ul li').removeClass('active');
    $('#draw_shape_action').addClass('active');
}


//Touch & Mouse Events for Drawing

function touchPreDraw(event) {
    if (isAndroid) {
        event.preventDefault();
    }
    draw = true;
    var offset = $(canvas).offset();
    line = {
        x: isAndroid ? event.touches[0].pageX : event.pageX - offset.left,
        y: isAndroid ? event.touches[0].pageY : event.pageY - offset.top,
        color: "#7FBF4D"
    };
    //    $('.map_info_title').html(line.y);
    //event.preventDefault();
    isShapeDrawingStarted = true;
    //Hint('Отпустите, чтобы закончить рисовать');
}

function touchDraw(event) {
    // if (bIsMobileView && !isAndroid){
    //     event.preventDefault();
    // }
    if (draw) {
        var offset = $(canvas).offset();
        moveX = isAndroid ? event.touches[0].pageX : event.pageX - offset.left - line.x,
        moveY = isAndroid ? event.touches[0].pageY : event.pageY - offset.top - line.y;
        if (isAndroid) {
            var ret = touchMoveAndroid(moveX, event.touches[0].pageY - Math.round(offset.top));
            line.x = ret.x;
            line.y = ret.y;
        } else {
            var ret = touchMove(moveX, moveY);
            line.x = ret.x;
            line.y = ret.y;
        }
        shapeMouse_coord_x.push(line.x + offset.left);
        shapeMouse_coord_y.push(line.y + offset.top);
    }
    if (shapeMouse_coord_x.length == 0) CursorHint.show('Нажмите на карту и, не отпуская, рисуйте', event);
    else if (shapeMouse_coord_x.length > 0 && shapeMouse_coord_x.length < 60) CursorHint.show('Продолжайте рисование', event);
    else if (shapeMouse_coord_x.length > 60) CursorHint.show('Можете отпустить, чтобы закончить рисование области', event);

}

function touchMoveAndroid(x, y) {
    // По какой-то причине самая первая точка смещается далеко вниз. 
    // Ее координаты не учитываются при построении полигона, но учитываются при рисовании зеленой линии.
    // Поэтому мы просто пропускаем первую точку при рисовании
    if (shapeMouse_coord_x.length > 0) {
        context.strokeStyle = line.color;
        context.lineWidth = 4;
        context.beginPath();
        context.moveTo(line.x, line.y);
        context.lineTo(x, y);
        context.stroke();
        context.closePath();
    }
    return {
        x: x,
        y: y
    };
}

function touchMove(changeX, changeY) {
    context.strokeStyle = line.color;
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(line.x, line.y);
    context.lineTo(line.x + changeX, line.y + changeY);
    context.stroke();
    context.closePath();
    return {
        x: line.x + changeX,
        y: line.y + changeY
    };
}

function touchEndDraw(event) {
    if (draw) {
        draw = false;
        context.clearRect(0, 0, canvas.width, canvas.height);
        ShowDrawing();
        isShapeDrawing = false;
        //Hint('Один клик - редактирование, два клика - удалить');
    }
    CursorHint.hide();
}

// Из сохраненного массива координат мыши получаются Широта и Долгота. Затем показывается нарисованная область на карте

function ShowDrawing() {
    // Скрываем Canvas, на котором рисовали
    var geometry = new Array;
    if (shapeMouse_coord_x.length == 0) {
        resetShapeDrawing();
        return;
    }
    for (var i = 0; i < shapeMouse_coord_x.length; i++) {
        // Создаем массив в котором хранятся географические координаты каждой 
        // точки передвижения мыши, которые мы сохранили при рисовании
        var globalPixelPoint = map.converter.pageToGlobal([shapeMouse_coord_x[i], shapeMouse_coord_y[i]]),
            mousePoint = map.options.get('projection').fromGlobalPixels(globalPixelPoint, map.getZoom());
        geometry.push(mousePoint);
    }

    // Добавляем в конец массива первую точку (замыкаем полигон)
    //geometry.push(geometry[0]);

    // Применяем алгоритм Дугласа Пьюкера для сглаживания сторон полигона
    geometry = GDouglasPeucker(geometry, kink[Math.round(map.getZoom()).toString()]);
    addPolygonOnMap([geometry], 'shape');


    resetShapeDrawing();



    //  polygon.setEditingOptions({
    //      vertexLayout: function () {

}

function resetShapeDrawing() {
    // Очищаем массив координат мыши
    shapeMouse_coord_x = [];
    shapeMouse_coord_y = [];
    // Удаляем события мыши и Touch-эвентов к Canvas
    if (canvas.removeEventListener) {
        canvas.removeEventListener('mousedown', touchPreDraw, false);
        canvas.removeEventListener('mousemove', touchDraw, false);
        canvas.removeEventListener('mouseup', touchEndDraw, false);
        canvas.removeEventListener('mouseleave', touchEndDraw, false);

        canvas.removeEventListener('touchstart', touchPreDraw, false);
        canvas.removeEventListener('touchmove', touchDraw, false);
        canvas.removeEventListener('touchend', touchEndDraw, false);
    } else if (canvas.detachEvent) {
        canvas.detachEvent('onmousedown', touchPreDraw);
        canvas.detachEvent('onmousemove', touchDraw);
        canvas.detachEvent('onmouseup', touchEndDraw);
    }

    // Скрываем Canvas
    $('#drawing-area').css('display', 'none');
    $('#draw_shape_action').removeClass('active');
}
//************************************************



function drawCircle() {
    if ($.browser.msie) isIE = true;
    $('.map_info_list_draw_actions ul li').removeClass('active');
    $('#draw_circle_action').addClass('active');
    //Hint('Нажмите на карте, чтобы разместить круг');
    StopEditingGeoObjects();
    map.events.add('click', mapEventsClickCircle);
    map.events.add('mousemove', mapEventsMouseMoveCircle);
    map.cursors.push('crosshair');
}

function resetPolygonDrawing() {
    // Очищаем коллекцию проставленных точек
        pointsCollection.removeAll();
    // Очищаем коллекцию соединительных линий
    map.geoObjects.each(function(obj) {
        if (obj.properties.get('id') == 'stayedPolyline') map.geoObjects.remove(obj);
    });

    map.geoObjects.remove(polyline);

    // Удаляем соответствующие события карты
    map.events.remove('click', mapClickEventPolygon);
    map.events.remove('mousemove', mapMouseMoveEventPolygon);
        pointsCollection.events.remove('click', pointsCollectionClickEventPolygon);
    $('#draw_poly_action').removeClass('active');
    CursorHint.hide();

}

function resetCircleDrawing() {
    map.events.remove('click', mapEventsClickCircle);
    map.events.remove('mousemove', mapEventsMouseMoveCircle);
    map.cursors.push('arrow');
    $('#draw_circle_action').removeClass('active');
    CursorHint.hide();
}

function DistanceBetweenTwoPoints(Point1, Point2) {
    var lat1 = Point1[1],
        lon1 = Point1[0],
        lat2 = Point2[1],
        lon2 = Point2[0];
    var R = 6371; // km
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.asin(Math.sqrt(a));
    var d = R * c;

    return d;
}

function Hint(text) {
    $('#hint').html(text);
};

var CursorHint = {
    show: function(text, e) {
        if (!CursorHint.isEnabled()) return;
        var css = {
            'display': 'block'
        };

        var mapMouseMoveHint = function(e) {
            //console.log(e);
        };

        $container = $('<div class="cursor_hint">' + text + '</div>');
        $($container).css(css);

        if ($('#map').find('.cursor_hint').length == 0)
            $('#map').append($container);
        else {
            $('.cursor_hint').html(text);
            $('#map').find('.cursor_hint').show();
        }

        _position(e);


        function _position(e) {
            var
                hintX = window.event ? window.event.screenX : e.screenX,
                hintY = top != self ? parent.window.event ?
                parent.window.event.pageY : e.pageY : window.event ? window.event.pageY : e.pageY,
                offsetX = (top !== self) ? (parent.window.innerWidth - document.body.offsetWidth) / 2 : (window.innerWidth - document.body.offsetWidth) / 2;
            $('.cursor_hint').css({
                top: hintY,
                left: hintX - offsetX
            });
        }
    },

    hide: function() {
        $('.cursor_hint').hide();
    },

    isEnabled: function() {
        var res = false;
        if (typeof map === 'undefined') return false;

        map.controls.each(function(obj) {
            if (typeof obj.options.get('name') != 'undefined' && obj.options.get('name') == 'cursor_hint_activator') {
                res = obj.isSelected();
            }
        });

        return res;
    }
};

function fitCanvas() {
    var
        canvas = document.getElementById('drawing-area'),
        w = document.getElementById('map2').offsetWidth,
        h = document.getElementById('map2').offsetHeight;

    canvas.width = w;
    canvas.height = h;
}

function isCanvasSupported() {
    var elem = document.createElement('canvas');
    return !!(elem.getContext && elem.getContext('2d'));
}