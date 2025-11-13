function toggleScreens(id) {
    var request = new XMLHttpRequest();
    var status = screenStatusForToggle(id)
    console.log("status = ", status)
    request.open("POST", `/screens/${id}/power/off`, true);
    request.setRequestHeader("Content-Type", "application/json");
    request.onreadystatechange = function() {
        if (request.readyState === 4) {
            if (request.status === 200) {
                var response = JSON.parse(request.responseText);
                console.log("Screen Power On Response:", response);
                alert(`Screen ${id} powered on successfully.`);
            } else {
                console.error("Error powering on screen:", request.statusText);
            }
        }
    };
    request.send();
}
function screenStatusForToggle(id) {
    var request = new XMLHttpRequest();
    request.open("GET", `screens/${id}/status`, true);
    request.setRequestHeader("Content-Type", "application/json");
    request.onreadystatechange = function() {
        if (request.readyState === 4) {
            if (request.status === 200) {
                var response = JSON.parse(request.responseText);
                console.log("Screen Status Response:", response);
                return response["state"];
            } else {
                console.error("Error getting screen status:", request.statusText);
            }
        }
    };
    request.send();
}
function screenStatus(id) {
    var request = new XMLHttpRequest();
    request.open("GET", `screens/${id}/status`, true);
    request.setRequestHeader("Content-Type", "application/json");
    request.onreadystatechange = function() {
        if (request.readyState === 4) {
            if (request.status === 200) {
                var response = JSON.parse(request.responseText);
                console.log("Screen Status Response:", response);
                alert(`Screen ${id} status: ${response.status}`);
            } else {
                console.error("Error getting screen status:", request.statusText);
            }
        }
    };
    request.send();
}