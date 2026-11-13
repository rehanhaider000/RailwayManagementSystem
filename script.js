```javascript
        bookingForm.reset();
        seatSelect.innerHTML = '<option value="">Select a seat</option>';

    } catch (error) {
        bookingMessage.textContent = error.message;
        bookingMessage.style.color = "red";
        console.error("BOOKING ERROR:", error);
    }
});

// ==================================
// MY BOOKINGS
// ==================================

const searchBookingsBtn = document.getElementById("searchBookingsBtn");

searchBookingsBtn.addEventListener("click", loadMyBookings);

async function loadMyBookings() {
    const token = sessionStorage.getItem("railwayToken");
    const savedPassenger = sessionStorage.getItem("railwayPassenger");
    const resultDiv = document.getElementById("myBookingsList");

    if (!token || !savedPassenger) {
        resultDiv.innerHTML = "<p>Please login first to view your bookings.</p>";
        return;
    }

    try {
        const passenger = JSON.parse(savedPassenger);
        document.getElementById("searchEmail").value = passenger.email;

        resultDiv.innerHTML = "<p>Loading your bookings...</p>";

        const response = await fetch(`${API_BASE}/MyBookings/mine`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${token}` }
        });

        const data = await parseResponse(response);

        if (!response.ok) {
            throw new Error(data.message || data.title || "Unable to load bookings.");
        }

        const bookings = data.bookings || [];

        if (bookings.length === 0) {
            resultDiv.innerHTML = "<p>No bookings found for your account.</p>";
            return;
        }

        resultDiv.innerHTML = "";

        bookings.forEach(booking => {
            const card = document.createElement("div");
            card.className = "my-booking-card";

            const bookingId = booking.bookingId ?? booking.BookingId;
            const passengerName = booking.passengerName ?? booking.PassengerName;
            const train = booking.trainName ?? booking.TrainName;
            const trainNumber = booking.trainNumber ?? booking.TrainNumber;
            const source = booking.sourceStation ?? booking.SourceStation;
            const destination = booking.destinationStation ?? booking.DestinationStation;
            const seat = booking.seatNumber ?? booking.SeatNumber;
            const fare = booking.fare ?? booking.Fare;
            const status = booking.status ?? booking.Status;
            const date = booking.bookingDate ?? booking.BookingDate;

            card.innerHTML = `
                <h3>${escapeHTML(train)} (${escapeHTML(trainNumber)})</h3>
                <p><strong>Booking ID:</strong> ${escapeHTML(bookingId)}</p>
                <p><strong>Passenger:</strong> ${escapeHTML(passengerName)}</p>
                <p><strong>Route:</strong> ${escapeHTML(source)} → ${escapeHTML(destination)}</p>
                <p><strong>Seat:</strong> ${escapeHTML(seat)}</p>
                <p><strong>Fare:</strong> Rs. ${Number(fare).toLocaleString()}</p>
                <p><strong>Booking Date:</strong> ${escapeHTML(formatDate(date))}</p>
                <p><strong>Status:</strong> <span class="booking-status">${escapeHTML(status)}</span></p>
            `;

            if (String(status).toLowerCase() === "confirmed") {
                const cancelButton = document.createElement("button");
                cancelButton.textContent = "Cancel Ticket";
                cancelButton.className = "cancel-ticket-btn";
                cancelButton.addEventListener("click", () => {
                    cancelBooking(bookingId, passenger.email);
                });
                card.appendChild(cancelButton);
            }

            resultDiv.appendChild(card);
        });

    } catch (error) {
        resultDiv.innerHTML = `<p>${escapeHTML(error.message)}</p>`;
        console.error("MY BOOKINGS ERROR:", error);
    }
}

// Cancel booking securely using JWT
async function cancelBooking(bookingId, email) {
    const token = sessionStorage.getItem("railwayToken");

    if (!token) {
        alert("Please login first to cancel your ticket.");
        return;
    }

    if (!confirm(`Are you sure you want to cancel Booking ID ${bookingId}?`)) {
        return;
    }

    try {
        const response = await fetch(
            `${API_BASE}/BookingManagement/cancel/${bookingId}`,
            {
                method: "PUT",
                headers: { "Authorization": `Bearer ${token}` }
            }
        );

        const result = await parseResponse(response);

        if (!response.ok) {
            throw new Error(result.message || result.title || "Ticket cancellation failed.");
        }

        alert("Your ticket has been cancelled successfully!");
        document.getElementById("searchEmail").value = email;
        await loadMyBookings();

    } catch (error) {
        alert(error.message);
        console.error("CANCELLATION ERROR:", error);
    }
}

// ==================================
// ADMIN LOGIN WITH JWT
// ==================================

const adminLoginForm = document.getElementById("adminLoginForm");
const adminLoginMessage = document.getElementById("adminLoginMessage");
const adminAuthBox = document.getElementById("adminAuthBox");
const adminPanel = document.getElementById("adminPanel");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");

function showAdminAccount() {
    const token = sessionStorage.getItem("railwayAdminToken");

    if (token) {
        adminAuthBox.style.display = "none";
        adminPanel.style.display = "block";
    } else {
        adminAuthBox.style.display = "block";
        adminPanel.style.display = "none";
    }
}

// ADMIN LOGIN
adminLoginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const loginData = {
        email: document.getElementById("adminEmail").value.trim(),
        password: document.getElementById("adminPassword").value
    };

    try {
        adminLoginMessage.textContent = "Checking admin credentials...";
        adminLoginMessage.style.color = "#17243b";

        const response = await fetch(`${API_BASE}/AdminAuth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(loginData)
        });

        const result = await parseResponse(response);

        if (!response.ok) {
            throw new Error(result.message || "Admin login failed.");
        }

        if (!result.token || result.role !== "Admin") {
            throw new Error("Valid admin token was not received.");
        }

        sessionStorage.setItem("railwayAdminToken", result.token);
        adminLoginMessage.textContent = "Admin login successful!";
        adminLoginMessage.style.color = "green";

        adminLoginForm.reset();
        showAdminAccount();

    } catch (error) {
        adminLoginMessage.textContent = error.message;
        adminLoginMessage.style.color = "red";
        console.error("ADMIN LOGIN ERROR:", error);
    }
});

// ADMIN LOGOUT
adminLogoutBtn.addEventListener("click", function () {
    sessionStorage.removeItem("railwayAdminToken");
    showAdminAccount();
    adminLoginMessage.textContent = "Admin logged out successfully.";
    adminLoginMessage.style.color = "green";
});

// ==================================
// ADMIN DASHBOARD WITH JWT
// ==================================

const loadAdminBtn = document.getElementById("loadAdminBtn");
loadAdminBtn.addEventListener("click", loadAdminDashboard);

async function loadAdminDashboard() {
    const token = sessionStorage.getItem("railwayAdminToken");
    const statsDiv = document.getElementById("adminStats");
    const bookingsDiv = document.getElementById("adminBookings");

    if (!token) {
        alert("Please login as Admin first.");
        showAdminAccount();
        return;
    }

    statsDiv.innerHTML = "<p>Loading dashboard...</p>";
    bookingsDiv.innerHTML = "<p>Loading bookings...</p>";

    loadAdminBtn.disabled = true;
    loadAdminBtn.textContent = "Loading...";

    try {
        const headers = { "Authorization": `Bearer ${token}` };

        const [statsResponse, bookingsResponse] = await Promise.all([
            fetch(`${API_BASE}/Admin/dashboard`, { headers }),
            fetch(`${API_BASE}/Admin/all-bookings`, { headers })
        ]);

        if ([statsResponse, bookingsResponse].some(r => r.status === 401 || r.status === 403)) {
            throw new Error("Admin session expired or unauthorized. Please login again.");
        }

        if (!statsResponse.ok || !bookingsResponse.ok) {
            throw new Error("Unable to load admin data.");
        }

        const statsData = await parseResponse(statsResponse);
        const bookingsData = await parseResponse(bookingsResponse);
        const stats = statsData.statistics || {};

        const totalTrains = stats.totalTrains ?? stats.TotalTrains ?? 0;
        const totalSchedules = stats.totalSchedules ?? stats.TotalSchedules ?? 0;
        const totalBookings = stats.totalBookings ?? stats.TotalBookings ?? 0;
        const confirmed = stats.confirmedBookings ?? stats.ConfirmedBookings ?? 0;
        const cancelled = stats.cancelledBookings ?? stats.CancelledBookings ?? 0;

        statsDiv.innerHTML = `            <div class="stat-card">
                <h3>Total Trains</h3>
                <p>${escapeHTML(totalTrains)}</p>
            </div>
            <div class="stat-card">
                <h3>Total Schedules</h3>
                <p>${escapeHTML(totalSchedules)}</p>
            </div>
            <div class="stat-card">
                <h3>Total Bookings</h3>
                <p>${escapeHTML(totalBookings)}</p>
            </div>
            <div class="stat-card">
                <h3>Confirmed Bookings</h3>
                <p>${escapeHTML(confirmed)}</p>
            </div>
            <div class="stat-card">
                <h3>Cancelled Bookings</h3>
                <p>${escapeHTML(cancelled)}</p>
            </div>
        `;

        const bookings = bookingsData.bookings || [];

        if (bookings.length === 0) {
            bookingsDiv.innerHTML = "<p>No booking records found.</p>";
            return;
        }

        const rows = bookings.map(booking => {
            const get = (lower, upper) =>
                booking[lower] ?? booking[upper] ?? "";

            return `
                <tr>
                    <td>${escapeHTML(get("bookingId", "BookingId"))}</td>
                    <td>${escapeHTML(get("passengerName", "PassengerName"))}</td>
                    <td>${escapeHTML(get("passengerEmail", "PassengerEmail"))}</td>
                    <td>${escapeHTML(get("trainName", "TrainName"))}</td>
                    <td>${escapeHTML(get("sourceStation", "SourceStation"))}</td>
                    <td>${escapeHTML(get("destinationStation", "DestinationStation"))}</td>
                    <td>${escapeHTML(get("seatNumber", "SeatNumber"))}</td>
                    <td>${escapeHTML(get("status", "Status"))}</td>
                </tr>
            `;
        }).join("");

        bookingsDiv.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Booking ID</th>
                        <th>Passenger</th>
                        <th>Email</th>
                        <th>Train</th>
                        <th>From</th>
                        <th>To</th>
                        <th>Seat</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;

    } catch (error) {
        statsDiv.innerHTML = `<p>${escapeHTML(error.message)}</p>`;
        bookingsDiv.innerHTML = "<p>Could not load booking records.</p>";

        if (error.message.includes("session expired")) {
            sessionStorage.removeItem("railwayAdminToken");
            showAdminAccount();
        }

        console.error("ADMIN DASHBOARD ERROR:", error);

    } finally {
        loadAdminBtn.disabled = false;
        loadAdminBtn.textContent = "Load Dashboard";
    }
}

// Restore admin login display
showAdminAccount();

// ==================================
// ADMIN TRAIN MANAGEMENT
// ==================================

const trainForm = document.getElementById("trainForm");
const trainMessage = document.getElementById("trainMessage");
const trainRecords = document.getElementById("trainRecords");

const loadTrainsBtn = document.getElementById("loadTrainsBtn");
const resetTrainBtn = document.getElementById("resetTrainBtn");

// LOAD ALL TRAINS
async function loadTrains() {
    trainRecords.innerHTML = "<p>Loading trains...</p>";

    try {
        const response = await fetch(`${API_BASE}/Train`);

        if (!response.ok) {
            throw new Error(await readApiError(response, "Unable to load trains."));
        }

        const trains = await parseResponse(response);
        trainRecords.innerHTML = "";

        if (!Array.isArray(trains) || trains.length === 0) {
            trainRecords.innerHTML = "<p>No trains found.</p>";
            return;
        }

        trains.forEach(train => {
            const id = train.trainId ?? train.TrainId;
            const name = train.trainName ?? train.TrainName;
            const number = train.trainNumber ?? train.TrainNumber;
            const seats = train.totalSeats ?? train.TotalSeats;

            const card = document.createElement("div");
            card.className = "train-record-card";

            card.innerHTML = `
                <h4>${escapeHTML(name)}</h4>
                <p><strong>Train ID:</strong> ${escapeHTML(id)}</p>
                <p><strong>Train Number:</strong> ${escapeHTML(number)}</p>
                <p><strong>Total Seats:</strong> ${escapeHTML(seats)}</p>
                <button type="button" class="train-edit-btn">Edit</button>
                <button type="button" class="train-delete-btn">Delete</button>
            `;

            card.querySelector(".train-edit-btn").addEventListener("click", () => {
                document.getElementById("editTrainId").value = id;
                document.getElementById("trainName").value = name;
                document.getElementById("trainNumber").value = number;
                document.getElementById("totalSeats").value = seats;

                document.getElementById("saveTrainBtn").textContent = "Update Train";
                trainMessage.textContent = `Editing Train ID: ${id}`;
                trainForm.scrollIntoView({ behavior: "smooth" });
            });

            card.querySelector(".train-delete-btn").addEventListener("click", () => {
                deleteTrain(id);
            });

            trainRecords.appendChild(card);
        });

    } catch (error) {
        trainRecords.innerHTML = `<p>${escapeHTML(error.message)}</p>`;
        console.error("LOAD TRAINS ERROR:", error);
    }
}

loadTrainsBtn.addEventListener("click", loadTrains);
resetTrainBtn.addEventListener("click", resetTrainForm);

// Add or update train
trainForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const trainId = document.getElementById("editTrainId").value;

    const trainData = {
        trainName: document.getElementById("trainName").value.trim(),
        trainNumber: document.getElementById("trainNumber").value.trim(),
        totalSeats: Number(document.getElementById("totalSeats").value)
    };

    if (trainData.totalSeats < 1) {
        trainMessage.textContent = "Total seats must be at least 1.";
        trainMessage.style.color = "red";
        return;
    }

    const url = trainId
        ? `${API_BASE}/Train/${trainId}`
        : `${API_BASE}/Train`;

    try {
        const response = await fetch(url, {
            method: trainId ? "PUT" : "POST",
            headers: getAdminHeaders(true),
            body: JSON.stringify(trainData)
        });

        if (!response.ok) {
            throw new Error(await readApiError(response, "Train operation failed."));
        }

        trainMessage.textContent = trainId
            ? "Train updated successfully!"
            : "New train added successfully!";

        trainMessage.style.color = "green";
        resetTrainForm();
        await loadTrains();

    } catch (error) {
        trainMessage.textContent = error.message;
        trainMessage.style.color = "red";
        console.error(error);
    }
});

// Delete train
async function deleteTrain(trainId) {
    if (!confirm(`Are you sure you want to delete Train ID ${trainId}?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/Train/${trainId}`, {
            method: "DELETE",
            headers: getAdminHeaders()
        });

        if (!response.ok) {
            throw new Error(await readApiError(response, "Unable to delete train."));
        }

        trainMessage.textContent = "Train deleted successfully!";
        trainMessage.style.color = "green";
        await loadTrains();

    } catch (error) {
        trainMessage.textContent = error.message;
        trainMessage.style.color = "red";
        console.error(error);
    }
}

// Clear form
function resetTrainForm() {
    trainForm.reset();
    document.getElementById("editTrainId").value = "";
    document.getElementById("saveTrainBtn").textContent = "Add Train";
}

// ==================================
// ADMIN SCHEDULE MANAGEMENT
// ==================================

const managementForm = document.getElementById("scheduleManagementForm");
const managementRecords = document.getElementById("managementScheduleRecords");
const managementMessage = document.getElementById("managementScheduleMessage");

document.getElementById("managementLoadBtn")
    .addEventListener("click", loadManagementSchedules);

document.getElementById("managementClearBtn")
    .addEventListener("click", clearManagementScheduleForm);

managementForm.addEventListener("submit", saveManagementSchedule);

// LOAD ALL SCHEDULES
async function loadManagementSchedules() {
    managementRecords.innerHTML = "<p>Loading schedules...</p>";

    try {
        const response = await fetch(`${API_BASE}/ScheduleManagement`);

        if (!response.ok) {
            throw new Error(await readApiError(response, "Could not load schedules."));
        }        const data = await parseResponse(response);
        const schedules = Array.isArray(data) ? data : [];

        if (schedules.length === 0) {
            managementRecords.innerHTML = "<p>No schedules found.</p>";
            return;
        }

        managementRecords.innerHTML = "";

        schedules.forEach(schedule => {
            const id = getScheduleId(schedule);
            const train = schedule.trainName ?? schedule.TrainName;
            const number = schedule.trainNumber ?? schedule.TrainNumber;
            const source = schedule.sourceStation ?? schedule.SourceStation;
            const destination = schedule.destinationStation ?? schedule.DestinationStation;
            const fare = schedule.fare ?? schedule.Fare;
            const departure = schedule.departureTime ?? schedule.DepartureTime;
            const arrival = schedule.arrivalTime ?? schedule.ArrivalTime;
            const trainId = schedule.trainId ?? schedule.TrainId;
            const sourceId = schedule.sourceStationId ?? schedule.SourceStationId;
            const destinationId = schedule.destinationStationId ?? schedule.DestinationStationId;

            const card = document.createElement("div");
            card.className = "management-schedule-card";

            card.innerHTML = `
                <h4>${escapeHTML(train ?? "Train")} (${escapeHTML(number ?? "")})</h4>
                <p><strong>Schedule ID:</strong> ${escapeHTML(id)}</p>
                <p><strong>Route:</strong> ${escapeHTML(source ?? "")} → ${escapeHTML(destination ?? "")}</p>
                <p><strong>Departure:</strong> ${escapeHTML(formatDate(departure))}</p>
                <p><strong>Arrival:</strong> ${escapeHTML(formatDate(arrival))}</p>
                <p><strong>Fare:</strong> Rs. ${escapeHTML(fare)}</p>
                <button class="management-edit-btn" type="button">Edit</button>
                <button class="management-delete-btn" type="button">Delete</button>
            `;

            card.querySelector(".management-edit-btn").addEventListener("click", () => {
                editManagementSchedule({
                    id, trainId, sourceId, destinationId,
                    departure, arrival, fare
                });
            });

            card.querySelector(".management-delete-btn").addEventListener("click", () => {
                deleteManagementSchedule(id);
            });

            managementRecords.appendChild(card);
        });

    } catch (error) {
        managementRecords.innerHTML = `<p>${escapeHTML(error.message)}</p>`;
        console.error("LOAD SCHEDULES ERROR:", error);
    }
}

// ADD OR UPDATE SCHEDULE
async function saveManagementSchedule(event) {
    event.preventDefault();

    const id = document.getElementById("managementScheduleId").value;

    const scheduleData = {
        trainId: Number(document.getElementById("managementTrainId").value),
        sourceStationId: Number(document.getElementById("managementSourceId").value),
        destinationStationId: Number(document.getElementById("managementDestinationId").value),
        departureTime: document.getElementById("managementDeparture").value,
        arrivalTime: document.getElementById("managementArrival").value,
        fare: Number(document.getElementById("managementFare").value)
    };

    if (scheduleData.sourceStationId === scheduleData.destinationStationId) {
        managementMessage.textContent = "Source and destination must be different.";
        return;
    }

    if (new Date(scheduleData.departureTime) >= new Date(scheduleData.arrivalTime)) {
        managementMessage.textContent = "Arrival must be after departure.";
        return;
    }

    try {
        const url = id
            ? `${API_BASE}/ScheduleManagement/${id}`
            : `${API_BASE}/ScheduleManagement`;

        const response = await fetch(url, {
            method: id ? "PUT" : "POST",
            headers: getAdminHeaders(true),
            body: JSON.stringify(scheduleData)
        });

        if (!response.ok) {
            throw new Error(await readApiError(response, "Schedule operation failed."));
        }

        managementMessage.textContent = id
            ? "Schedule updated successfully!"
            : "Schedule added successfully!";

        clearManagementScheduleForm();
        await loadManagementSchedules();

    } catch (error) {
        managementMessage.textContent = error.message;
        console.error("SAVE SCHEDULE ERROR:", error);
    }
}

// EDIT SCHEDULE
function editManagementSchedule(schedule) {
    document.getElementById("managementScheduleId").value = schedule.id;
    document.getElementById("managementTrainId").value = schedule.trainId;
    document.getElementById("managementSourceId").value = schedule.sourceId;
    document.getElementById("managementDestinationId").value = schedule.destinationId;
    document.getElementById("managementDeparture").value =
        toDateTimeLocal(schedule.departure);
    document.getElementById("managementArrival").value =
        toDateTimeLocal(schedule.arrival);
    document.getElementById("managementFare").value = schedule.fare;

    document.getElementById("managementSaveBtn").textContent = "Update Schedule";
    managementMessage.textContent = "Editing schedule ID: " + schedule.id;

    managementForm.scrollIntoView({ behavior: "smooth" });
}

// DELETE SCHEDULE
async function deleteManagementSchedule(id) {
    const scheduleId = Number(id);

    if (!Number.isInteger(scheduleId) || scheduleId <= 0) {
        managementMessage.textContent =
            `Invalid Schedule ID received: ${String(id)}. Reload schedules and check the API response.`;
        managementMessage.style.color = "red";
        console.error("INVALID SCHEDULE ID:", id);
        return;
    }

    if (!confirm(`Are you sure you want to delete Schedule ID ${scheduleId}?`)) {
        return;
    }

    try {
        const response = await fetch(
            `${API_BASE}/ScheduleManagement/${scheduleId}`,
            {
                method: "DELETE",
                headers: getAdminHeaders()
            }
        );

        const result = await parseResponse(response);

        if (!response.ok) {
            throw new Error(
                result.message ||
                result.title ||
                `Could not delete schedule. (HTTP ${response.status})`
            );
        }

        managementMessage.textContent = "Schedule deleted successfully!";
        managementMessage.style.color = "green";
        await loadManagementSchedules();

    } catch (error) {
        managementMessage.textContent = error.message;
        managementMessage.style.color = "red";
        console.error("DELETE SCHEDULE ERROR:", error);
    }
}

// CLEAR FORM
function clearManagementScheduleForm() {
    managementForm.reset();
    document.getElementById("managementScheduleId").value = "";
    document.getElementById("managementSaveBtn").textContent = "Add Schedule";
}

// ==================================
// ADMIN STATION MANAGEMENT
// ==================================

const stationForm = document.getElementById("stationForm");
const stationRecords = document.getElementById("stationRecords");
const stationMessage = document.getElementById("stationMessage");

document.getElementById("loadStationsBtn")
    .addEventListener("click", loadStations);

document.getElementById("resetStationBtn")
    .addEventListener("click", clearStationForm);

stationForm.addEventListener("submit", saveStation);

// LOAD STATIONS
async function loadStations() {
    stationRecords.innerHTML = "<p>Loading stations...</p>";

    try {
        const response = await fetch(`${API_BASE}/StationManagement`);

        if (!response.ok) {
            throw new Error(await readApiError(response, "Could not load stations."));
        }

        const data = await parseResponse(response);
        const stations = Array.isArray(data) ? data : [];

        if (stations.length === 0) {
            stationRecords.innerHTML = "<p>No stations found.</p>";
            return;
        }

        stationRecords.innerHTML = "";

        stations.forEach(station => {
            const id = station.stationId ?? station.StationId ?? station.stationid;
            const name = station.stationName ?? station.StationName ?? station.stationname;
            const city = station.city ?? station.City;

            const card = document.createElement("div");
            card.className = "station-record-card";

            card.innerHTML = `
                <h4>${escapeHTML(name ?? "")}</h4>
                <p><strong>Station ID:</strong> ${escapeHTML(id)}</p>
                <p><strong>City:</strong> ${escapeHTML(city ?? "")}</p>
                <button type="button" class="station-edit-btn">Edit</button>
                <button type="button" class="station-delete-btn">Delete</button>
            `;

            card.querySelector(".station-edit-btn")
                .addEventListener("click", () => editStation(id, name, city));

            card.querySelector(".station-delete-btn")
                .addEventListener("click", () => deleteStation(id));

            stationRecords.appendChild(card);
        });

    } catch (error) {
        stationRecords.innerHTML = `<p>${escapeHTML(error.message)}</p>`;
        console.error("LOAD STATIONS ERROR:", error);
    }
}

// ADD OR UPDATE STATION
async function saveStation(event) {
    event.preventDefault();

    const id = document.getElementById("editStationId").value;

    const stationData = {
        stationName: document.getElementById("stationName").value.trim(),
        city: document.getElementById("stationCity").value.trim()
    };

    if (!stationData.stationName || !stationData.city) {
        stationMessage.textContent = "Please fill in both fields.";
        return;
    }

    try {
        const url = id
            ? `${API_BASE}/StationManagement/${id}`
            : `${API_BASE}/StationManagement`;

        const response = await fetch(url, {
            method: id ? "PUT" : "POST",
            headers: getAdminHeaders(true),
            body: JSON.stringify(stationData)
        });

        if (!response.ok) {
            throw new Error(await readApiError(response, "Station operation failed."));
        }

        stationMessage.textContent = id
            ? "Station updated successfully!"
            : "Station added successfully!";

        clearStationForm();
        await loadStations();

    } catch (error) {
        stationMessage.textContent = error.message;
        console.error("SAVE STATION ERROR:", error);
    }
}// EDIT STATION
function editStation(id, name, city) {
    if (id === undefined || id === null || id === "undefined") {
        stationMessage.textContent =
            "Station ID missing from API response. Check the Network tab.";
        return;
    }

    document.getElementById("editStationId").value = id;
    document.getElementById("stationName").value = name;
    document.getElementById("stationCity").value = city;

    document.getElementById("saveStationBtn").textContent = "Update Station";
    stationMessage.textContent = "Editing station ID: " + id;

    stationForm.scrollIntoView({ behavior: "smooth" });
}

// DELETE STATION
async function deleteStation(id) {
    if (!confirm("Are you sure you want to delete this station?")) {
        return;
    }

    try {
        const response = await fetch(
            `${API_BASE}/StationManagement/${id}`,
            {
                method: "DELETE",
                headers: getAdminHeaders()
            }
        );

        if (!response.ok) {
            throw new Error(await readApiError(response, "Could not delete station."));
        }

        stationMessage.textContent = "Station deleted successfully!";
        await loadStations();

    } catch (error) {
        stationMessage.textContent = error.message;
        console.error("DELETE STATION ERROR:", error);
    }
}

// CLEAR FORM
function clearStationForm() {
    stationForm.reset();

    document.getElementById("editStationId").value = "";
    document.getElementById("saveStationBtn").textContent = "Add Station";
}

// ==================================
// PASSENGER LOGIN & REGISTRATION
// ==================================

const passengerRegisterForm =
    document.getElementById("passengerRegisterForm");

const passengerLoginForm =
    document.getElementById("passengerLoginForm");

const registerMessage =
    document.getElementById("registerMessage");

const loginMessage =
    document.getElementById("loginMessage");

// REGISTER PASSENGER
passengerRegisterForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const passengerData = {
        passengerName: document.getElementById("registerName").value.trim(),
        email: document.getElementById("registerEmail").value.trim(),
        password: document.getElementById("registerPassword").value
    };

    try {
        const response = await fetch(`${API_BASE}/PassengerAuth/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(passengerData)
        });

        const result = await parseResponse(response);

        if (!response.ok) {
            throw new Error(result.message || "Registration failed.");
        }

        registerMessage.textContent =
            "Registration successful! You can now login.";
        registerMessage.style.color = "green";

        passengerRegisterForm.reset();

        document.getElementById("loginEmail").value = passengerData.email;

    } catch (error) {
        registerMessage.textContent = error.message;
        registerMessage.style.color = "red";
        console.error("REGISTER ERROR:", error);
    }
});

// LOGIN PASSENGER WITH JWT TOKEN
passengerLoginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const loginData = {
        email: document.getElementById("loginEmail").value.trim(),
        password: document.getElementById("loginPassword").value
    };

    try {
        const response = await fetch(`${API_BASE}/PassengerAuth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(loginData)
        });

        const result = await parseResponse(response);

        if (!response.ok) {
            throw new Error(result.message || "Login failed.");
        }

        if (!result.token) {
            throw new Error("JWT token was not received from backend.");
        }

        // Save passenger profile
        sessionStorage.setItem("railwayPassenger", JSON.stringify({
            passengerId: result.passengerId,
            passengerName: result.passengerName,
            email: result.email
        }));

        // Save JWT token
        sessionStorage.setItem("railwayToken", result.token);

        loginMessage.textContent =
            "Login successful! Secure session started.";
        loginMessage.style.color = "green";

        passengerLoginForm.reset();
        showPassengerAccount();

    } catch (error) {
        loginMessage.textContent = error.message;
        loginMessage.style.color = "red";
        console.error("LOGIN ERROR:", error);
    }
});

// SHOW LOGGED-IN PASSENGER
function showPassengerAccount() {
    const savedPassenger = sessionStorage.getItem("railwayPassenger");

    if (!savedPassenger) {
        document.getElementById("authForms").style.display = "grid";
        document.getElementById("loggedInPanel").style.display = "none";
        return;
    }

    const passenger = JSON.parse(savedPassenger);

    document.getElementById("authForms").style.display = "none";
    document.getElementById("loggedInPanel").style.display = "block";

    document.getElementById("loggedInName").textContent =
        passenger.passengerName;
}

// LOGOUT PASSENGER
document.getElementById("passengerLogoutBtn")
    .addEventListener("click", function () {

        sessionStorage.removeItem("railwayPassenger");
        sessionStorage.removeItem("railwayToken");

        showPassengerAccount();

        loginMessage.textContent = "You have logged out successfully.";
        loginMessage.style.color = "green";
    });

// ==================================
// START
// ==================================

// Load public schedules when the page opens
loadSchedules();

// Restore login display when page loads
showPassengerAccount();
