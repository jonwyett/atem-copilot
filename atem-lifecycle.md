# ATEM Co-Pilot Application Lifecycle

## Overview

This document outlines the lifecycle of the ATEM Co-Pilot application, explaining the interactions between the server components and the web interface. The application allows users to map ATEM switcher inputs to various outputs (ME2, AUX1-4) and provides real-time state monitoring.

## System Components

- **Web Interface (index.html)**: The user-facing interface for mapping and monitoring
- **Server (copilot_server.js)**: Express server that handles API requests and WebSocket connections
- **ATEM Co-Pilot (atemCopilot.js)**: Core logic for managing mappings and ATEM interactions
- **ATEM Shim (atem-shim.js)**: Low-level interface to the ATEM switcher hardware

## Initialization Flow

```mermaid
sequenceDiagram
    participant Browser
    participant Server
    participant ATEMCoPilot
    participant ATEMShim
    participant ATEMHardware
    
    Note over Browser,ATEMHardware: Application Startup
    
    Browser->>Server: Request index.html
    Server-->>Browser: Return index.html
    
    Note over Browser: Page Loads
    
    Browser->>Server: GET /api/inputs
    Server->>ATEMCoPilot: getInputs()
    ATEMCoPilot->>ATEMShim: getInputs()
    ATEMShim-->>ATEMCoPilot: Return inputs
    ATEMCoPilot-->>Server: Return inputs
    Server-->>Browser: Return inputs JSON
    
    Browser->>Server: GET /api/mapping
    Server->>ATEMCoPilot: getMapping()
    ATEMCoPilot-->>Server: Return mapping
    Server-->>Browser: Return mapping JSON
    
    Browser->>Server: WebSocket Connection
    Server-->>Browser: 'Connected to server' message
    Server-->>Browser: Current state
    Server-->>Browser: Current inputs
    Server-->>Browser: Current mapping
    
    Note over ATEMShim,ATEMHardware: ATEM Connection
    
    ATEMShim->>ATEMHardware: Connect to ATEM
    ATEMHardware-->>ATEMShim: Connection established
    ATEMShim->>ATEMCoPilot: 'started' event
    ATEMCoPilot->>ATEMCoPilot: loadMapping()
    ATEMCoPilot->>ATEMShim: getInputs()
    ATEMShim-->>ATEMCoPilot: Return inputs
    ATEMCoPilot->>Server: 'log' event with inputs
    Server->>Browser: WebSocket 'log' event with inputs
```

## User Interaction Flows

### Adding a New Mapping

```mermaid
sequenceDiagram
    participant Browser
    participant Server
    participant ATEMCoPilot
    
    Note over Browser,ATEMCoPilot: User Adds New Mapping
    
    Browser->>Browser: User selects input from dropdown
    Browser->>Browser: User clicks "Add" button
    Browser->>Browser: Create empty mapping object
    Browser->>Server: POST /api/mapping
    Server->>ATEMCoPilot: updateMapping()
    ATEMCoPilot->>ATEMCoPilot: saveMapping()
    ATEMCoPilot-->>Server: Return success
    Server-->>Browser: Return success
    Browser->>Browser: renderTable()
    Browser->>Browser: renderAddMapping()
```

### Updating a Mapping

```mermaid
sequenceDiagram
    participant Browser
    participant Server
    participant ATEMCoPilot
    
    Note over Browser,ATEMCoPilot: User Updates Mapping
    
    Browser->>Browser: User changes dropdown selection
    Browser->>Server: POST /api/mapping
    Server->>ATEMCoPilot: updateMapping()
    ATEMCoPilot->>ATEMCoPilot: saveMapping()
    ATEMCoPilot-->>Server: Return success
    Server-->>Browser: Return success
    Browser->>Browser: renderTable()
```

### Deleting a Mapping

```mermaid
sequenceDiagram
    participant Browser
    participant Server
    participant ATEMCoPilot
    
    Note over Browser,ATEMCoPilot: User Deletes Mapping
    
    Browser->>Browser: User clicks "Delete" button
    Browser->>Server: DELETE /api/mapping/:input
    Server->>ATEMCoPilot: deleteMapping()
    ATEMCoPilot->>ATEMCoPilot: saveMapping()
    ATEMCoPilot-->>Server: Return success
    Server-->>Browser: Return success
    Browser->>Browser: renderTable()
    Browser->>Browser: renderAddMapping()
```

## Real-time State Updates

```mermaid
sequenceDiagram
    participant ATEMHardware
    participant ATEMShim
    participant ATEMCoPilot
    participant Server
    participant Browser
    
    Note over ATEMHardware,Browser: ATEM State Change
    
    ATEMHardware->>ATEMShim: State change
    ATEMShim->>ATEMShim: processRoutingState()
    ATEMShim->>ATEMCoPilot: 'stateChanged' event
    ATEMCoPilot->>ATEMCoPilot: Update currentState
    ATEMCoPilot->>ATEMCoPilot: Check for mapping triggers
    ATEMCoPilot->>Server: 'state' event
    Server->>Browser: WebSocket 'state' event
    Browser->>Browser: updateRowHighlighting()
    Browser->>Browser: updateStateBar()
```

## Mapping Trigger Flow

```mermaid
sequenceDiagram
    participant ATEMHardware
    participant ATEMShim
    participant ATEMCoPilot
    participant Server
    participant Browser
    
    Note over ATEMHardware,Browser: ME1 Program Change Triggers Mapping
    
    ATEMHardware->>ATEMShim: ME1 Program change
    ATEMShim->>ATEMCoPilot: 'stateChanged' event
    ATEMCoPilot->>ATEMCoPilot: applyProgramMapping()
    ATEMCoPilot->>ATEMShim: changeProgramInput() for ME2
    ATEMShim->>ATEMHardware: Set ME2 Program
    ATEMCoPilot->>ATEMShim: setAuxSource() for each AUX
    ATEMShim->>ATEMHardware: Set AUX sources
    ATEMCoPilot->>Server: 'log' events
    Server->>Browser: WebSocket 'log' events
    ATEMCoPilot->>Server: 'state' event
    Server->>Browser: WebSocket 'state' event
    Browser->>Browser: updateRowHighlighting()
    Browser->>Browser: updateStateBar()
```

## Log Filtering

```mermaid
sequenceDiagram
    participant Browser
    participant Server
    
    Note over Browser,Server: User Filters Logs
    
    Browser->>Browser: User types in filter input
    Browser->>Browser: Filter paragraphs in debug window
    Browser->>Browser: Show/hide paragraphs based on filter
```

## Detailed Component Interactions

### Server (copilot_server.js)

The server component:
- Serves static files (index.html, CSS, JS)
- Provides REST API endpoints for inputs, mapping, and state
- Handles WebSocket connections for real-time updates
- Forwards events from the ATEM Co-Pilot to connected clients

### ATEM Co-Pilot (atemCopilot.js)

The ATEM Co-Pilot component:
- Manages the mapping between inputs and outputs
- Loads and saves mapping configuration
- Applies mappings when ATEM state changes
- Forwards events from the ATEM Shim to the server

### ATEM Shim (atem-shim.js)

The ATEM Shim component:
- Connects to the ATEM hardware
- Provides a clean interface for controlling the ATEM
- Processes state changes from the ATEM
- Converts ATEM paths to human-readable format

### Web Interface (index.html)

The web interface:
- Displays the current mapping configuration
- Allows users to add, update, and delete mappings
- Shows real-time state of the ATEM
- Provides a debug window with filtered logs

## State Management

The application maintains several key state objects:

1. **ATEM State**: Current state of the ATEM switcher (ME1, ME2, AUX1-4)
2. **Mapping Data**: Configuration of how inputs map to outputs
3. **Input Data**: List of available inputs from the ATEM
4. **Previous AUX Values**: Used to detect changes for visual feedback

## Event Flow

Events flow through the system as follows:

1. **Hardware Events**: Changes in the ATEM hardware trigger events in the ATEM Shim
2. **State Events**: ATEM Shim processes state changes and emits them to ATEM Co-Pilot
3. **Mapping Events**: ATEM Co-Pilot applies mappings and emits events to the server
4. **Server Events**: Server forwards events to connected clients via WebSocket
5. **UI Events**: Browser updates the UI based on received events

## Conclusion

The ATEM Co-Pilot application uses a combination of REST APIs and WebSockets to provide real-time interaction with an ATEM switcher. The modular architecture allows for clean separation of concerns between the hardware interface, business logic, and user interface components. 