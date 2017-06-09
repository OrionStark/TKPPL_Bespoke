var music;
var fft;
var canvas;
var button;
var stopbutton;
var nextbutton;
var a = 0;
var prevbutton;
var storedSound = ["../../audio/Maroon 5 - Payphone Free Online Music.MP3", "../../audio/Marshmello - Alone.mp3", "../../audio/Marshmello - Colour.mp3"];
var song = [];
function preload(){
    //music = loadSound("Music/Perfume - JPN 2011.11.30/" + storedSound[a]);
    for(var i = 0; i < storedSound.length; i++){
    	song[i] = loadSound(storedSound[i]);
    }
    music = song[a];
	
}
/*
function buttonSetup()
{
}
function togglePlaying() {
  if (!music.isPlaying()) {
    //music = song[a];
    music.play();
    music.setVolume(1);
    button.html("Pause");
  } else {
    music.pause();
    button.html("Play");
  }
}
function stopPlaying(){
    if(music.isPlaying())
    {
        music.stop();
        button.html("Play");
    }
}
function nextS(){
    	music.stop();
    	button.html("Pause");
    	if(a == storedSound.length -1){
		a = a;
	} else {
	a += 1;
	}
	//music = loadSound("Music/Perfume - JPN 2011.11.30/" + storedSound[a]);
    	music = song[a];
    	music.play();
}
function prevS(){
	music.stop();
	button.html("Pause");
	if(a == 0){
		a == a;
	} else {
		a -= 1;
	}
	music = song[a];
	music.play();

}
*/
function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("test");
  music = song[0];
  music.play();
  fft = new p5.FFT();
  music.amp(1);
}
function windowResized(){
  resizeCanvas(windowWidth-13, windowHeight);
}
function draw() {
  var r = 200;
  var rad = 70;
  var waveform = fft.waveform();
  background(0);
  //background(0);
  noFill();
  console.log(rad);
  strokeWeight(2);
  stroke(22, 134, 204);
  translate(width/2, height/2);
  ellipse(0, 0, 2 * rad, 2 * rad);
  stroke(232, 9, 124);
  for(var i = 0; i < waveform.length; i += 4){
    var x = r * cos(i * 2 * PI / waveform.length);
    var y = r * sin(i * 2 * PI / waveform.length);
    var x2 = (r + waveform[i] * 80) * cos(i * 2 * PI / waveform.length);
    var y2 = (r + waveform[i] * 80) * sin(i * 2 * PI / waveform.length);
    line(x, y, x2, y2);
    point(x, y);
  }
  beginShape();
  for(var i = 0; i < waveform.length; i += 30){
      var x2 = (r + waveform[i] * 100) * cos(i * 2 * PI / waveform.length);
      var y2 = (r + waveform[i] * 100) * sin(i * 2 * PI / waveform.length);
      push();
      stroke(255);
      strokeWeight(5);
      point(x2, y2);
      pop();
  }
  endShape();
}
