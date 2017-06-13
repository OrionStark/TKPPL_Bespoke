/*
	Really.... my page will completely slow if I make more project at this page
	So I just make 3 project code to demonstrate P5JS and Processing.


	If you want more, you can check codingtrain channel on youtube presented by Daniel Shiffman


	or follow my Instagram to see my own project all the time. {orion_stark}

*/

// Prototype for Sound in my presentation
/*
	Author : Robby Muhammad Nst
	Special thanks to : Daniel Shiffman (He teach everyone how fun coding is) / my special teacher when I'm bored of school coding
	Thanks to github community specially at P5JS Repository
	Thanks to Processing

*/
//=========================================================================
var p = function(p){
	var storedSound = ["build/audio/Maroon 5 - Payphone Free Online Music.MP3", "build/audio/Marshmello - Alone.mp3", "build/audio/Marshmello - Colour.mp3", "build/audio/The Chainsmokers Feat. Daya - Don't Let Me Down.mp3"];
	var song = [];
	var music;
	var fft;
	var canvas;
	var a = 0;
	var prevbutton;
	var nextbtn;
	var togglebtn;
	var stopbtn;
	p.buttonCreate = function()
	{
		p.prevbutton = p.createDiv('Prev');
		p.nextbtn = p.createDiv('Next');
		p.togglebtn = p.createDiv('Play');
		p.stopbtn = p.createDiv('Stop');
		p.prevbutton.parent('prev');
		//prevbutton.class('prev');
		p.nextbtn.parent('next');
		//nextbtn.class('next');
		p.togglebtn.parent('toggleplay');
		//togglebtn.class('toggleplay');
		p.stopbtn.parent('stop');
		//stopbtn.class('stop');
	};
	p.togglePlaying = function(){
		if (!music.isPlaying()) {
    			//music = song[a];
    			p.music.loop();
    			p.music.setVolume(1);
    			p.togglebtn.html("Pause");
  		} else {
    			p.music.pause();
    			p.togglebtn.html("Play");
  		}
	};
	p.stopPlaying = function(){
		if(music.isPlaying())
		{
			p.music.stop();
			p.togglebtn.html("Play");
		}
		else
		{
			p.music.stop();
			p.togglebtn.html("Play");
		}
	};
	p.nextMusic = function()
	{
		if(a + 1 < song.length)
		{
			p.music.stop();
			a += 1;
			p.music = song[a];
			p.music.loop();
			p.togglebtn.html('Pause');
		}else{
			a = a;
		}
	};
	p.prevMusic = function()
	{
		if(a - 1 >= 0)
		{
			p.music.stop();
			a -= 1;
			p.music = song[a];
			p.music.loop();
			p.togglebtn.html('Pause');
		}
	};
	p.musicSelection = function(i)
	{
		a = i;
		p.music.stop();
		p.music = song[i];
		p.music.loop();
		p.togglebtn.html('Pause');

	};
	p.preload = function(){
    		//music = loadSound("Music/Perfume - JPN 2011.11.30/" + storedSound[a]);
    		for(var i = 0; i < storedSound.length; i++){
    			song[i] = p.loadSound(storedSound[i]);
    		}
    		music = song[a];
	
	};
	p.setup = function() {
  		p.createCanvas(470, p.windowHeight);
  		//p.canvas.parent("test");
  		p.buttonCreate();
  		p.togglebtn.mousePressed(p.togglePlaying);
  		p.prevbutton.mousePressed(p.prevMusic);
  		p.stopbtn.mousePressed(p.stopPlaying);
  		p.nextbtn.mousePressed(p.nextMusic);
  		p.music = song[0];
  		p.fft = new p5.FFT();
  		p.music.amp(1);
	};
	p.windowResized = function(){
  		p.resizeCanvas(470, p.windowHeight);
	};
	p.draw = function() {
  		var r = 180;
  		var rad = 50;
  		var waveform = p.fft.waveform();
  		p.background(0);
  		p.clear()
  		//background(0);
  		p.noFill();
  		//console.log(rad);
  		p.strokeWeight(2);
  		p.stroke(255);
  		p.translate(p.width/2, p.height/2);
  		p.ellipse(0, 0, 2 * rad, 2 * rad);
  		p.stroke(255,255,255);
  		for(var i = 0; i < waveform.length; i += 4){
    			var x = r * p.cos(i * 2 * p.PI / waveform.length);
    			var y = r * p.sin(i * 2 * p.PI / waveform.length);
    			var x2 = (r + waveform[i] * 80) * p.cos(i * 2 * p.PI / waveform.length);
    			var y2 = (r + waveform[i] * 80) * p.sin(i * 2 * p.PI / waveform.length);
    			p.line(x, y, x2, y2);
    			p.point(x, y);
  		}
  		p.beginShape();
  		for(var i = 0; i < waveform.length; i += 30){
      			var x2 = (r + waveform[i] * 100) * p.cos(i * 2 * p.PI / waveform.length);
      			var y2 = (r + waveform[i] * 100) * p.sin(i * 2 * p.PI / waveform.length);
      			p.push();
      			p.stroke(255);
      			p.strokeWeight(5);
      			p.point(x2, y2);
      			p.pop();
  		}
  		p.endShape();
	};
};
//============================================================================= End
//This guy just like an object from a class in OOP mindset :XD
var myp5 = new p5(p, "test");

/*

	This is the begin of function prototype of 3D Terrain
	
	This code is implementation from processing with Java programming [Thanks Daniel Shiffman]
	
	
*/
var terrain = function(terrain){
	/*
  		Author: Robby Muhammad Nst
  		Tutorial and references : Daniel Shiffman
  		Thanks to github community who has tells about the noFill() function
  		is not working with TRIANGLE_STRIP
	*/

	var scl = 120;
	var sketch_grab = [];
	var cols, rows;
	var flying = 0;
	var h = 4200;
	terrain.setup = function() {
 		terrain.createCanvas(terrain.windowWidth, terrain.windowHeight, terrain.WEBGL);
  		cols = terrain.windowWidth * 3 / scl;
  		rows = h / scl;
  		for(var x = 0; x < cols; x++)
  		{
    			sketch_grab[x] = [];
  		}
	};
	terrain.windowResized = function(){
    		terrain.resizeCanvas(terrain.windowWidth, terrain.windowHeight);
	};

	terrain.draw = function() {
  		flying -= 0.1;
  		var yoff = flying;
		terrain.background(255);
  		for(var y = 0; y < rows; y++)
  		{
    			var xoff = 0;
    			for(var x =0; x < cols; x++)
    			{
      				sketch_grab[x][y] = terrain.map(terrain.noise(xoff, yoff), 0, 1, -100, 100);
      				xoff += 0.2;
    			}
    			yoff += 0.2;
  		}
  		terrain.translate(0, 50);
  		terrain.rotateX(-terrain.PI/2.7);
  		terrain.translate(-terrain.windowWidth * 1.5, -h/2);
  		terrain.noFill();
  		//strokeWeight(4);
  		//stroke(255);
  		for(var y = 0; y < rows; y++)
  		{
    			terrain.beginShape(); 
    			terrain.noFill();
    			for(var x = 0; x < cols - 1; x++)
    			{
      				terrain.push();
      				// stroke doesn't work this time
      				//stroke(255);
      				terrain.translate(x * scl, y * scl, sketch_grab[x][y]);
      				terrain.vertex(x * scl, y * scl, sketch_grab[x][y]);
      				terrain.vertex(x * scl, (y + 1) * scl, sketch_grab[x][y + 1]);
      				terrain.pop();
    			}
    			terrain.endShape();
  		}
	};
};
//========================================================================= End

var terrain_builder = new p5(terrain, "full-page");


/*


	Author : Robby Muhammad Nst
	
	Under this comment is the code that could make random particle with
	random colors and size that will going to it's velocity to moving arround the windows

	
	=======================================================================
*/
/*
function Bubblecreator(){};
Bubblecreator.prototype = {
	createbub : function(){
    		this.x = this.width/2;
    		this.y = this.height/2;
    		this.bx = random(-5, 5);
    		this.by = random(-5, 5);
    		this.rad = random(10, 50);
    		this.Red = random(0, 255);
    		this.Green = random(0, 255);
    		this.Blue = random(0, 255);
  	},
  	fillandsize : function(){
    		p5.fill(this.Red, this.Green, this.Blue);
    		p5.ellipse(this.x, this.y, this.rad, this.rad);
    		this.x = this.x + this.bx;
    		this.y = this.y + this.by;
    		if(this.x > this.width - this.rad/2)
    		{
      			this.bx = -1 * this.Math.abs(this.bx);
    		}
    		if(this.x < this.rad/2)
    		{
      			this.bx = this.Math.abs(this.bx);
    		}
    		if(this.y > height - this.rad/2)
    		{
      			this.by = -1 * this.Math.abs(this.by);
    		}
    		if(this.y < this.rad/2)
    		{
      			this.by = this.Math.abs(this.by);
    		}
  	}
}
*/
/*

	This page is getting lagging because, we used 3 canvas that request animation frames all the times
	and at the same time. So it could make the page and the particles run slowly XD

	And if you know, the draw function for each feature is do infinite looping to draw a new frame every time
	So if we used 3 canvas that will run together at one page. it's too god damn hight.

*/
var buble = function(buble){
	var Bubblecreator = function()
	{
		this.x = buble.width/2;
    		this.y = buble.height/2;
    		this.bx = buble.random(-5, 5);
    		this.by = buble.random(-5, 5);
    		this.rad = buble.random(10, 50);
   		this.Red = buble.random(0, 255);
   		this.Green = buble.random(0, 255);
    		this.Blue = buble.random(0, 255);
	};
	Bubblecreator.prototype.fillandsize = function(){
		buble.fill(this.Red, this.Green, this.Blue);
    		buble.ellipse(this.x, this.y, this.rad, this.rad);
    		this.x = this.x + this.bx;
    		this.y = this.y + this.by;
    		if(this.x > buble.width - this.rad/2)
    		{
      			this.bx = -1 * Math.abs(this.bx);
    		}
    		if(this.x < this.rad/2)
    		{
      			this.bx = Math.abs(this.bx);
    		}
    		if(this.y > buble.height - this.rad/2)
    		{
      			this.by = -1 * Math.abs(this.by);
    		}
    		if(this.y < this.rad/2)
    		{
      			this.by = Math.abs(this.by);
    		}
	};
	var bubles = [];
	buble.setup = function() {
  		buble.createCanvas(buble.windowWidth-380, buble.windowHeight-195);  
  		for(var i = 0; i < 90; i++)
  		{
     			bubles[i] = new Bubblecreator();
  		}
	};

	buble.draw = function() {
  		buble.background(255);
		buble.clear();
  		for(var i = 0; i < bubles.length; i++)
  		{
    			bubles[i].fillandsize();
  		};
	};
	buble.windowResized = function(){
  		buble.resizeCanvas(buble.windowWidth-340, buble.windowHeight-185);
	}
};
/*

	Let's call it

*/
var give_me_bubles = new p5(buble, "giveme-bubles");
