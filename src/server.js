// simple webserver using express to serve html files
// ISYS3001 - Managing Software Development A3

// import the modules
const express=require("express"); // for a webserver (express)
const bodyParser=require("body-parser"); // parse the body of the request
const path=require("path"); // handle file paths

// create a new express webserver app
const app=express();

//to parse URL-encoded data
app.use(bodyParser.urlencoded({extended:true}));

//to serve static files
app.use(express.static(__dirname));

//route to serve index.html (load html and send to client)
//first endpoint - using GET message
app.get("/",(req,res)=>{
  // render/send the index.html file
  res.sendFile(path.join(__dirname,"index.html"));
});

// start running the webserver on port 3030
app.listen(3030,()=>{
  console.log("Server running at http://localhost:3030");
});