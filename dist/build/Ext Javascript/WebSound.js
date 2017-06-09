var music;
var fft;
var canvas;
var a = 0;
var prevbutton;
var nextbtn;
var togglebtn;
var stopbtn;
var storedSound = ["../../audio/Maroon 5 - Payphone Free Online Music.MP3", "../../audio/Marshmello - Alone.mp3", "../../audio/Marshmello - Colour.mp3", "../../audio/The Chainsmokers Feat. Daya - Don't Let Me Down.mp3"];
var song = [];
function preload(){
    //music = loadSound("Music/Perfume - JPN 2011.11.30/" + storedSound[a]);
    for(var i = 0; i < storedSound.length; i++){
    	song[i] = loadSound(storedSound[i]);
    }
    music = song[a];
	
}
function buttonCreate()
{
	prevbutton = createDiv('Prev');
	nextbtn = createDiv('Next');
	togglebtn = createDiv('Play');
	stopbtn = createDiv('Stop');
	prevbutton.parent('prev');
	//prevbutton.class('prev');
	nextbtn.parent('next');
	//nextbtn.class('next');
	togglebtn.parent('toggleplay');
	//togglebtn.class('toggleplay');
	stopbtn.parent('stop');
	//stopbtn.class('stop');
}
function togglePlaying(){
	if (!music.isPlaying()) {
    		//music = song[a];
    		music.loop();
    		music.setVolume(1);
    		togglebtn.html("Pause");
  	} else {
    		music.pause();
    		togglebtn.html("Play");
  	}
}
function stopPlaying(){
	if(music.isPlaying())
	{
		music.stop();
		togglebtn.html("Play");
	}
	else
	{
		music.stop();
		togglebtn.html("Play");
	}
}
function nextMusic()
{
	if(a + 1 < song.length)
	{
		music.stop();
		a += 1;
		music = song[a];
		music.loop();
		togglebtn.html('Pause');
	}else{
		a = a;
	}
}
function prevMusic()
{
	if(a - 1 >= 0)
	{
		music.stop();
		a -= 1;
		music = song[a];
		music.loop();
		togglebtn.html('Pause');
	}
}
function musicSelection(i)
{
	a = i;
	music.stop();
	music = song[i];
	music.loop();
	togglebtn.html('Pause');

}
function setup() {
  canvas = createCanvas(470, windowHeight);
  canvas.parent("test");
  buttonCreate();
  togglebtn.mousePressed(togglePlaying);
  prevbutton.mousePressed(prevMusic);
  stopbtn.mousePressed(stopPlaying);
  nextbtn.mousePressed(nextMusic);
  music = song[0];
  fft = new p5.FFT();
  music.amp(1);
}
function windowResized(){
  resizeCanvas(470, windowHeight);
}
function draw() {
  var r = 180;
  var rad = 50;
  var waveform = fft.waveform();
  background(0);
  clear()
  //background(0);
  noFill();
  console.log(rad);
  strokeWeight(2);
  stroke(255);
  translate(width/2, height/2);
  ellipse(0, 0, 2 * rad, 2 * rad);
  stroke(255,255,255);
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
