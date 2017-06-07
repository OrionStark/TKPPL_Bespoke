/*

  AUTHOR : Robby Muhammad Nst
  A.K.A  : OrionStark
  IG     : orion_stark     [check for more project]

*/
//Define a global variable for catch buble in collection
var buble = [];
function setup() {
  createCanvas(windowWidth, windowHeight);
  
  for(var i = 0; i < 90; i++)
  {
     buble[i] = new Bubblecreator();
     buble[i].createbub();
  };
}

function draw() {
  background(0);
  
  for(var i = 0; i < buble.length; i++)
  {
    buble[i].fillandsize();
  };
}
function windowResized(){
  resizeCanvas(windowWidth, windowHeight);
}

//Used like a class but it's not
function Bubblecreator(){};
Bubblecreator.prototype = {
  createbub : function(){
    this.x = width/2;
    this.y = height/2;
    this.bx = random(-5, 5);
    this.by = random(-5, 5);
    this.rad = random(10, 50);
    this.Red = random(0, 255);
    this.Green = random(0, 255);
    this.Blue = random(0, 255);
  },
  
  fillandsize : function(){
    fill(this.Red, this.Green, this.Blue);
    ellipse(this.x, this.y, this.rad, this.rad);
    this.x = this.x + this.bx;
    this.y = this.y + this.by;
    if(this.x > width - this.rad/2)
    {
      this.bx = -1 * Math.abs(this.bx);
    }
    if(this.x < this.rad/2)
    {
      this.bx = Math.abs(this.bx);
    }
    if(this.y > height - this.rad/2)
    {
      this.by = -1 * Math.abs(this.by);
    }
    if(this.y < this.rad/2)
    {
      this.by = Math.abs(this.by);
    }
  }
}
