/*
	Author : Robby Muhammad Nst


*/

var rgbArr = ["rgb(66, 134, 244)", "rgb(149, 66, 244)", "rgb(244, 113, 65)", "rgb(150, 148, 7)"];
$(".firstpage").css("transition","0.4s");
function changeColor(){
	$(".firstpage").css({
		background: rgbArr[Math.floor(Math.random() * rgbArr.length)]
	});
}
changeColor();
setInterval(changeColor, 3000);
$("#1").ready(function(){
	$(".title").animate({marginTop: '+=300px'}, "slow");
	$(".title").ready(function(){
		$(".hello").fadeIn(3000);	
	});
});
$("#2").ready(function(){
	$(".p5jsimg").fadeIn(4000);
});
