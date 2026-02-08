# IDEAS_project
Major Project by Cedric Lee and Keegan Teoh for the Temasek Polytechnic School of Design, IDEAS Laboratory.

The IoT dashboard can control the multitude of devices in the IDEAS Lab:
1. QM65C Samsung Commercial Displays
2. Tapo P110 Smart Plugs (lighting)
3. Windows Computers (for project display)
4. EPSON EB-PU1007W WUXGA 3LCD Projectors

# Instructions on deployment
1. clone the repository onto your device 'git clone https://github.com/admiralmochii/IDEAS_project"
2. Download dependencies 'npm install' in the main project folder, ./server and ./client
3. Follow instructions.txt in ./python_services to prepare the python service for smart plug control
4. Get the .env files for ./server, ./client and ./python_services, edit variables as needed (host, account details etc.)
5. Follow instructions.txt in ./python_services to turn on the python service
6. Run ' node server.mjs' in ./server

# Device setup instructions
Read 'Device_setup_instructions.txt' 

# Project Directory breakdown
client - Frontend dashboard related files  

client/src/assets - Fonts, Icons, images used in the project  

client/src/components - Elements inside the pages such as modals, device cards, sidebars  

client/src/contexts - Holds the websocketcontext for use in components requiring real time updates of device status  

client/src/hooks - contains the useDeviceWebSocket.js for handling the websocket connection and handle messages from the backend of device status updates  

client/src/layouts - contains the file that dictates the app layout  

client/src/pages - contains the various pages of the application  

client/src/services - contains the frontend logic for communication with the backend  

client/src/styles - contains the CSS styling for the frontend  

client/App.jsx - main app file, also has all the react router dom configurations here  
  
  
python_services - contains files related to the python service used by the backend to control the Tapo P110 smart plugs, specifically, the FastAPI and uvicorn server  

  
server - backend related files  

server/auth - files related to authentication, encryption of passwords using hash and salt 

server/db - files related to connection with the local MongoDB database  

server/routes - backend functionality (control devices, CRUD for devices, CRUD for schedules) along with their routes  

server/utils - utility files, the files here are the lockManager.mjs file which handles the locking of devices to prevent multiple control commands executing at the same time which might cause errors and the devicesearch.mjs file which provides usage of functions related to scanning the network to find devices  

server/backgroundSync.mjs - handles the regular checking on device status and broadcast of new device status to the frontend via the websocket  

server/schedule_executor.mjs - handles the checking of and running of scheduled control actions   

server/server.mjs - main nodejs server file node this file to start the server and the websocket server  

# Routes
**-------- Device Routes --------**  
GET /device/refresh - runs the device refresh function to ping the whole network and update any changed IP addresses based on the device's MAC addresses in the database, not implemented in the frontend or anywhere else except for on server startup, to use this if needed either restart the server or use postman to call the route  

GET /device/refresh/:name - same as refresh but for specific device found by name, also not implemented anywhere  
POST /device/add - add device to database  
PUT /device/update/:id - update device by device id  
DELETE /device/delete/:device - delete device by device name  

**--------------------------------**  
  
**-------- Lights Routes --------**  
GET /lights/status/:light_name - manually get the power status of the Tapo smart plug, replaced by websocket implementation but still available for use in testing
POST /lights/wake/:light_name - power on Tapo smart plug  
POST /lights/shutdown/:light_name - power off Tapo smart plug  

**--------------------------------**  

**-------- Computer Routes --------**  
POST /computer/wake/:computer_name - power on computer by name  
POST /computer/shutdown/:computer_name - power off computer by name  
GET /computer/status - manually get the power status of all computers, replaced by websocket implementation but still available for use in testing  

**--------------------------------**  

**-------- Projector Routes --------**  
POST /projector/wake/:projector_name - power on projector by name  
POST /projector/shutdown/:projector_name - power off projector by name  

**--------------------------------**  

**-------- Screen Routes --------**  
GET /screens/ - get all screens devices, replaced by websocket implementation but still available for use in testing  
POST /screens/wake/:screen_name - power on Samsung screen by name  
POST /screens/shutdown/:screen_name - power off Samsung screen by name  

**--------------------------------**  

**-------- Schedule Routes --------**  
POST /schedule/schedules - add new schedule  
GET /schedule/schedules - get all schedules with options to filter by control action (on/off), id, day of week although the filter is not implemented  
GET /schedule/schedules/:id - get schedule by id  
PATCH /schedule/schedules/:id - update schedule by id  
DELETE /schedule/schedules/:id - delete schedule by id  

**--------------------------------**  

**-------- User Routes --------**  
GET /users/logout - route to log the user out of the session  
GET /users/auth - route used to check if the user is authorized  
GET /users/:id - get user by id, requires executor to be logged in, not implemented used for testing  
GET /verify-reset-request/:resetId - verify password reset request on load into password request page  
POST /users/register - add user to the database, currently it is commented out as there isnt a need for more accounts for the application, it can be uncommented and used via postman for adding new accounts if needed  
  
POST /users/login - logs in user into the session  
POST /users/forgot-password - checks if the input email corresponds with a user in the database before creating a password reset request and sending an email with the reset link  
POST /users/reset-password - resets the user's password   
PATCH /users/:id - update user details  
DELETE /users/:id - delete user from database currently it is commented out as there isnt a need for deleting accounts for the application, it can be uncommented and used via postman for adding new accounts if needed  

**--------------------------------**  



