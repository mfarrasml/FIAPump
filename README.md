# FIAPump
Desktop application for microfluidic pump system

FIAPump desktop application is used to configure a microfluidic pumping sequence and run it on a connected microfluidic pump device based on user's input, and monitor the running sequence in real time.

Features:
<ul>
  <li>Pumping sequence with multiple configurable steps,</li>
   <ul>
     <li>3 selectable pumps, configurable flow rate and flow direction. Each step runs based on configurable duration or target volume.</li>
   </ul>
  <li>Saveable sequence data for future usage,</li>
  <li>FIAPump device setup,</li>
  <li>Start/stop function,</li>
  <li>Real time info and monitoring of the running pumping sequence:</li>
   <ul>
     <li>Currently running pump</li>
     <li>Pumping direction</li>
     <li>Current flowrate (with graph)</li>
     <li>Duration/volume left for the current step</li>
   </ul>
</ul>

<hr>

The app was built using <a href="https:/electronjs.org" target="_blank"><code>Electron.js</code></a> framework.

Application distribution packages used in the project:
<ul>
  <li><code>electron.js</code></li>the base-application's framework
  <li><code>chart.js</code></li>used to build chart for monitoring the pump's flow rate in real time
  <li><code>serialport</code></li>serial connection to the pump system's microcontroller
</ul>
<hr>

# Installation
Install all the dependencies by running the following code on the folder directory.
```
npm install
```

# Running the App
Run the following code on command prompt to launch the app.
```
npm start
```

# Building the App
Run the following code on command prompt.
```
npm run make
```
A folder named 'out' will be created, containing a distributable app, an app installer, and a zip file containing the distributable.
```
... (root folder)
-> out
  -> FIAPump-win32-x64      (the resulting distributable FIAPump app folder)
  -> make                   
    -> squirrel.windows     (folder containing the app installer for windows)
    -> zip                  (folder containing the app .zip file)
```
For more info about the application build/distribution, go to <a href="https://www.electronforge.io/" target="_blank"><code>electron-forge</code></a>


# Application Preview

1. Sequence configuration
![halaman penginputan parameter sekuens](https://user-images.githubusercontent.com/31495135/160281423-5c6748b7-5953-4301-b3b0-cbe9ed61551c.JPG)

2. Microfluidic pump device (FIAPump) selection
![halaman setup koneksi dengan sistem pompa](https://user-images.githubusercontent.com/31495135/160281424-b304f1fe-5049-4376-944f-63907f1574df.JPG)

3. Running sequence information/monitoring
![halaman informasi pengaliran sekuens](https://user-images.githubusercontent.com/31495135/160281408-b7aa2fa2-bc75-4ee7-8ab7-53b84eb09cb6.JPG) 
