var myMap;
$(function() {
    ymaps.ready(mapInit);


    $('#result').on('click', '.del', function() {
        var self = this;
        $.ajax({
          url: '/back.php',
          data: {
            'do': 'delete',
            'id': $(self).attr('data-id')
          },
          success: function(){
            $(self).parent().parent().fadeOut();
          },
        });
        return false;
    });

    $('#save').click(function(){
        $.ajax({
          url: '/back.php',
          data: {
            'do': 'save',
            'id': saveData.id,
            'point': JSON.stringify(saveData.point),
            'poligon': JSON.stringify(saveData.polygon),
            'region': saveData.region,
            'address': saveData.address
          },
          success: function(res){
            res = parseInt(res);
            if(res > 0) {
                activePlaceMark.id = res;
                activePlaceMark.lastColor = 'green';
                $.notify("Точка сохранена", "success");
            }
            $('#result').append('<tr><td>'+JSON.stringify(saveData.point)+'</td><td  style="font-size: 10px;">'+JSON.stringify(saveData.polygon)+'</td><td>'+saveData.region+'</td><td>'+saveData.address+'</td><td><a href="" class="del" data-id="'+res+'"><span class="glyphicon glyphicon-remove" aria-hidden="true"></span></a></td></tr>');
          }
        });
    });
});