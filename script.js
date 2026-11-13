const API_BASE = "https://localhost:7163/api";

// ==================================
// COMMON HELPERS
// ==================================

const $ = id => document.getElementById(id);

// Get first defined value from an object (camelCase / PascalCase / lowercase)
function pick(obj, ...keys) {
    for (const key of keys) {
        if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key];
    }
    return undefined;
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function formatDate(value) {
    if (!value) return "Not available";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
}

// Convert any date to value for <input type="datetime-local"> in LOCAL time
function toLocalInput(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
           `T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function showMsg(element, text, color) {
    if (!element) return;
    element.textContent = text;
    element.style.color = color || "";
}

// Pull a readable message out of any backend response
function extractMessage(data, status, fallback) {
    if (data) {
        if (data.message) return data.message;
        if (data.title && !data.errors) return data.title;
        if (data.errors) {
            const first = Object.values(data.errors).flat()[0];
            if (first) return first;
        }
        if (data.title) return data.title;
    }
    return `${fallback} (HTTP ${status})`;
}

/*
 * SAFE request helper.
 * Never crashes on an empty body (204, 401, 403, etc.).
 * Returns parsed JSON ({} if body is empty). Throws Error with a clear message.
 */
async function apiRequest(url, options = {}, fallbackMessage = "Request failed.") {
    let response;
    try {
        response = await fetch(url, options);
    } catch (networkError) {
        throw new Error("Cannot reach the server. Make sure your backend is running.");
    }

    const text = await response.text();
    let data = {};

    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = { message: text };
        }
    }

    if (!response.ok) {
        const error = new Error(extractMessage(data, response.status, fallbackMessage));
        error.status = response.status;
        throw error;
    }

    return data;
}

// ==================================
// ADMIN AUTH HELPERS
// ==================================

function getAdminHeaders(includeJson = false) {
    const token = sessionStorage.getItem("railwayAdminToken");

    if (!token) {
        throw new Error("Please login as Admin first.");
    }

    const headers = { "Authorization": `Bearer ${token}` };

    if (includeJson) {
        headers["Content-Type"] = "application/json";
    }

    return headers;
}

// Request with admin token. Handles expired session automatically.
async function adminRequest(url, method = "GET", body = null, fallbackMessage = "Operation failed.") {
    const options = {
        method,
        headers: getAdminHeaders(body !== null)
    };

    if (body !== null) {
        options.body = JSON.stringify(body);
    }

    try {
        return await apiRequest(url, options, fallbackMessage);
    } catch (error) {
        if (error.status === 401 || error.status === 403) {
            sessionStorage.removeItem("railwayAdminToken");
            showAdminAccount();
            throw new Error("Admin session expired or unauthorized. Please login again.");
        }
        throw error;
    }
}

// ==================================
// PUBLIC: SCHEDULES + BOOKING
// ==================================

const scheduleList = $("scheduleList");
const scheduleSelect = $("scheduleSelect");
const seatSelect = $("seatSelect");
const bookingForm = $("bookingForm");
const bookingMessage = $("bookingMessage");

async function loadSchedules() {
    try {
        const data = await apiRequest(
            `${API_BASE}/Schedule/merge-sort`, {}, "Could not load train schedules."
        );

        const schedules = Array.isArray(data)
            ? data
            : (data.schedules || data.Schedules || []);

        scheduleList.innerHTML = "";
        scheduleSelect.innerHTML = '<option value="">Select a schedule</option>';

        if (schedules.length === 0) {
            scheduleList.textContent = "No train schedules available.";
            return;
        }

        schedules.forEach(schedule => {
            const id = pick(schedule, "scheduleId", "ScheduleId");
            const train = pick(schedule, "trainName", "TrainName") ?? "Train";
            const number = pick(schedule, "trainNumber", "TrainNumber") ?? "";
            const source = pick(schedule, "sourceStation", "SourceStation") ?? "";
            const destination = pick(schedule, "destinationStation", "DestinationStation") ?? "";
            const departure = pick(schedule, "departureTime", "DepartureTime") ?? "";
            const arrival = pick(schedule, "arrivalTime", "ArrivalTime") ?? "";
            const fare = pick(schedule, "fare", "Fare") ?? 0;

            const card = document.createElement("div");
            card.className = "schedule-card";
            card.innerHTML = `
                <h3>${escapeHTML(train)}</h3>
                <p><strong>Train Number:</strong> ${escapeHTML(number)}</p>
                <p><strong>From:</strong> ${escapeHTML(source)}</p>
                <p><strong>To:</strong> ${escapeHTML(destination)}</p>
                <p><strong>Departure:</strong> ${escapeHTML(formatDate(departure))}</p>
                <p><strong>Arrival:</strong> ${escapeHTML(formatDate(arrival))}</p>
                <p><strong>Fare:</strong> Rs. ${Number(fare).toLocaleString()}</p>
            `;
            scheduleList.appendChild(card);

            const option = document.createElement("option");
            option.value = id;
            option.textContent = `${train} - ${source} to ${destination}`;
            scheduleSelect.appendChild(option);
        });

    } catch (error) {
        scheduleList.textContent = "Unable to load schedules. Make sure your backend is running.";
        console.error(error);
    }
}

async function loadAvailableSeats(scheduleId) {
    seatSelect.innerHTML = '<option value="">Loading seats...</option>';

    if (!scheduleId) {
        seatSelect.innerHTML = '<option value="">Select a seat</option>';
        return;
    }

    try {
        const data = await apiRequest(
            `${API_BASE}/BookingManagement/available-seats/${scheduleId}`,
            {}, "Could not load available seats."
        );

        const seats = Array.isArray(data)
            ? data
            : (data.availableSeats || data.AvailableSeats || []);

        seatSelect.innerHTML = '<option value="">Select a seat</option>';

        if (!Array.isArray(seats) || seats.length === 0) {
            seatSelect.innerHTML = '<option value="">No available seats</option>';
            return;
        }

        seats.forEach(seat => {
            const option = document.createElement("option");
            option.value = pick(seat, "seatId", "SeatId");
            option.textContent = `Seat ${pick(seat, "seatNumber", "SeatNumber")}`;
            seatSelect.appendChild(option);
        });

    } catch (error) {
        seatSelect.innerHTML = '<option value="">Unable to load seats</option>';
        console.error(error);
    }
}

scheduleSelect.addEventListener("change", () => {
    loadAvailableSeats(scheduleSelect.value);
});

bookingForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const token = sessionStorage.getItem("railwayToken");
    const savedPassenger = sessionStorage.getItem("railwayPassenger");

    if (!token || !savedPassenger) {
        showMsg(bookingMessage, "Please login first to book a ticket.", "red");
        return;
    }

    if (!scheduleSelect.value || !seatSelect.value) {
        showMsg(bookingMessage, "Please select a schedule and seat.", "red");
        return;
    }

    const bookingData = {
        passengerName: $("passengerName").value.trim(),
        passengerEmail: $("passengerEmail").value.trim(),
        scheduleId: Number(scheduleSelect.value),
        seatId: Number(seatSelect.value)
    };

    if (!bookingData.scheduleId || !bookingData.seatId) {
        showMsg(bookingMessage, "Please select a valid schedule and seat.", "red");
        return;
    }

    try {
        showMsg(bookingMessage, "Processing your secure booking...", "#17243b");

        const result = await apiRequest(`${API_BASE}/BookingManagement/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(bookingData)
        }, "Booking failed.");

        const bookingId = pick(result, "bookingId", "BookingId");

        showMsg(
            bookingMessage,
            bookingId
                ? `Booking successful! Your Booking ID is ${bookingId}.`
                : "Your ticket has been booked successfully!",
            "green"
        );

        bookingForm.reset();
        seatSelect.innerHTML = '<option value="">Select a seat</option>';

    } catch (error) {
        showMsg(bookingMessage, error.message, "red");
        console.error("BOOKING ERROR:", error);
    }
});

loadSchedules();

// ==================================
// PASSENGER: MY BOOKINGS
// ==================================

$("searchBookingsBtn").addEventListener("click", loadMyBookings);

async function loadMyBookings() {
    const token = sessionStorage.getItem("railwayToken");
    const savedPassenger = sessionStorage.getItem("railwayPassenger");
    const resultDiv = $("myBookingsList");

    if (!token || !savedPassenger) {
        resultDiv.innerHTML = "<p>Please login first to view your bookings.</p>";
        return;
    }

    try {
        const passenger = JSON.parse(savedPassenger);
        $("searchEmail").value = passenger.email;
        resultDiv.innerHTML = "<p>Loading your bookings...</p>";

        const data = await apiRequest(`${API_BASE}/MyBookings/mine`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${token}` }
        }, "Unable to load bookings.");

        const bookings = data.bookings || (Array.isArray(data) ? data : []);

        if (bookings.length === 0) {
            resultDiv.innerHTML = "<p>No bookings found for your account.</p>";
            return;
        }

        resultDiv.innerHTML = "";

        bookings.forEach(booking => {
            const card = document.createElement("div");
            card.className = "my-booking-card";

            const bookingId = pick(booking, "bookingId", "BookingId");
            const passengerName = pick(booking, "passengerName", "PassengerName");
            const train = pick(booking, "trainName", "TrainName");
            const trainNumber = pick(booking, "trainNumber", "TrainNumber");
            const source = pick(booking, "sourceStation", "SourceStation");
            const destination = pick(booking, "destinationStation", "DestinationStation");
            const seat = pick(booking, "seatNumber", "SeatNumber");
            const fare = pick(booking, "fare", "Fare");
            const status = pick(booking, "status", "Status");
            const date = pick(booking, "bookingDate", "BookingDate");

            card.innerHTML = `
                <h3>${escapeHTML(train)} (${escapeHTML(trainNumber)})</h3>
                <p><strong>Booking ID:</strong> ${escapeHTML(bookingId)}</p>
                <p><strong>Passenger:</strong> ${escapeHTML(passengerName)}</p>
                <p><strong>Route:</strong> ${escapeHTML(source)} → ${escapeHTML(destination)}</p>
                <p><strong>Seat:</strong> ${escapeHTML(seat)}</p>
                <p><strong>Fare:</strong> Rs. ${Number(fare).toLocaleString()}</p>
                <p><strong>Booking Date:</strong> ${escapeHTML(formatDate(date))}</p>
                <p><strong>Status:</strong>
                    <span class="booking-status">${escapeHTML(status)}</span>
                </p>
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

async function cancelBooking(bookingId, email) {
    const token = sessionStorage.getItem("railwayToken");

    if (!token) {
        alert("Please login first to cancel your ticket.");
        return;
    }

    if (!confirm(`Are you sure you want to cancel Booking ID ${bookingId}?`)) return;

    try {
        await apiRequest(`${API_BASE}/BookingManagement/cancel/${bookingId}`, {
            method: "PUT",
            headers: { "Authorization": `Bearer ${token}` }
        }, "Ticket cancellation failed.");

        alert("Your ticket has been cancelled successfully!");
        $("searchEmail").value = email;
        await loadMyBookings();

    } catch (error) {
        alert(error.message);
        console.error("CANCELLATION ERROR:", error);
    }
}

// ==================================
// ADMIN LOGIN / LOGOUT
// ==================================

const adminLoginForm = $("adminLoginForm");
const adminLoginMessage = $("adminLoginMessage");
const adminAuthBox = $("adminAuthBox");
const adminPanel = $("adminPanel");
const adminLogoutBtn = $("adminLogoutBtn");

function showAdminAccount() {
    const token = sessionStorage.getItem("railwayAdminToken");
    adminAuthBox.style.display = token ? "none" : "block";
    adminPanel.style.display = token ? "block" : "none";
}

adminLoginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const loginData = {
        email: $("adminEmail").value.trim(),
        password: $("adminPassword").value
    };

    try {
        showMsg(adminLoginMessage, "Checking admin credentials...", "#17243b");

        const result = await apiRequest(`${API_BASE}/AdminAuth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(loginData)
        }, "Admin login failed.");

        if (!result.token || result.role !== "Admin") {
            throw new Error("Valid admin token was not received.");
        }

        sessionStorage.setItem("railwayAdminToken", result.token);

        showMsg(adminLoginMessage, "Admin login successful!", "green");
        adminLoginForm.reset();
        showAdminAccount();

    } catch (error) {
        showMsg(adminLoginMessage, error.message, "red");
        console.error("ADMIN LOGIN ERROR:", error);
    }
});

adminLogoutBtn.addEventListener("click", function () {
    sessionStorage.removeItem("railwayAdminToken");
    showAdminAccount();
    showMsg(adminLoginMessage, "Admin logged out successfully.", "green");
});

// ==================================
// ADMIN DASHBOARD
// ==================================

const loadAdminBtn = $("loadAdminBtn");
loadAdminBtn.addEventListener("click", loadAdminDashboard);

async function loadAdminDashboard() {
    const statsDiv = $("adminStats");
    const bookingsDiv = $("adminBookings");

    if (!sessionStorage.getItem("railwayAdminToken")) {
        alert("Please login as Admin first.");
        showAdminAccount();
        return;
    }

    statsDiv.innerHTML = "<p>Loading dashboard...</p>";
    bookingsDiv.innerHTML = "<p>Loading bookings...</p>";
    loadAdminBtn.disabled = true;
    loadAdminBtn.textContent = "Loading...";

    try {
        const [statsData, bookingsData] = await Promise.all([
            adminRequest(`${API_BASE}/Admin/dashboard`, "GET", null, "Unable to load dashboard."),
            adminRequest(`${API_BASE}/Admin/all-bookings`, "GET", null, "Unable to load bookings.")
        ]);

        const stats = statsData.statistics || statsData.Statistics || {};

        const cards = [
            ["Total Trains", pick(stats, "totalTrains", "TotalTrains")],
            ["Total Schedules", pick(stats, "totalSchedules", "TotalSchedules")],
            ["Total Bookings", pick(stats, "totalBookings", "TotalBookings")],
            ["Confirmed Bookings", pick(stats, "confirmedBookings", "ConfirmedBookings")],
            ["Cancelled Bookings", pick(stats, "cancelledBookings", "CancelledBookings")]
        ];

        statsDiv.innerHTML = cards.map(([label, value]) => `
            <div class="stat-card">
                <h3>${label}</h3>
                <p>${escapeHTML(value ?? 0)}</p>
            </div>
        `).join("");

        const bookings = bookingsData.bookings || (Array.isArray(bookingsData) ? bookingsData : []);

        if (bookings.length === 0) {
            bookingsDiv.innerHTML = "<p>No booking records found.</p>";
            return;
        }

        const rows = bookings.map(booking => {
            const get = (lower, upper) => pick(booking, lower, upper) ?? "";
            const bookingId = get("bookingId", "BookingId");

            return `
                <tr>
                    <td>${escapeHTML(bookingId)}</td>
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
        console.error("ADMIN DASHBOARD ERROR:", error);

    } finally {
        loadAdminBtn.disabled = false;
        loadAdminBtn.textContent = "Load Dashboard";
    }
}

showAdminAccount();

// ==================================
// ADMIN TRAIN MANAGEMENT
// NOTE: Change these ids if your HTML uses different ones.
// ==================================

const TRAIN_IDS = {
    form: "trainForm",
    message: "trainMessage",
    editId: "editTrainId",
    name: "trainName",
    number: "trainNumber",
    seats: "totalSeats",
    saveBtn: "saveTrainBtn",
    records: "trainRecords",
    loadBtn: "loadTrainsBtn"
};

const trainForm = $(TRAIN_IDS.form);
const trainMessage = $(TRAIN_IDS.message);
const trainRecords = $(TRAIN_IDS.records);

async function loadTrains() {
    if (!trainRecords) return;

    trainRecords.innerHTML = "<p>Loading trains...</p>";

    try {
        const data = await apiRequest(`${API_BASE}/Train`, {}, "Could not load trains.");
        const trains = Array.isArray(data) ? data : (data.trains || data.Trains || []);

        if (trains.length === 0) {
            trainRecords.innerHTML = "<p>No trains found.</p>";
            return;
        }

        trainRecords.innerHTML = "";

        trains.forEach(train => {
            const id = pick(train, "trainId", "TrainId", "trainid");
            const name = pick(train, "trainName", "TrainName", "trainname") ?? "";
            const number = pick(train, "trainNumber", "TrainNumber", "trainnumber") ?? "";
            const seats = pick(train, "totalSeats", "TotalSeats", "totalseats") ?? "";

            const card = document.createElement("div");
            card.className = "train-record-card";
            card.innerHTML = `
                <h4>${escapeHTML(name)} (${escapeHTML(number)})</h4>
                <p><strong>Train ID:</strong> ${escapeHTML(id)}</p>
                <p><strong>Total Seats:</strong> ${escapeHTML(seats)}</p>
                <button type="button" class="train-edit-btn">Edit</button>
                <button type="button" class="train-delete-btn">Delete</button>
            `;

            card.querySelector(".train-edit-btn").addEventListener("click", () => {
                $(TRAIN_IDS.editId).value = id;
                $(TRAIN_IDS.name).value = name;
                $(TRAIN_IDS.number).value = number;
                $(TRAIN_IDS.seats).value = seats;
                $(TRAIN_IDS.saveBtn).textContent = "Update Train";
                showMsg(trainMessage, "Editing train ID: " + id, "");
                trainForm.scrollIntoView({ behavior: "smooth" });
            });

            card.querySelector(".train-delete-btn").addEventListener("click", () => {
                deleteTrain(id);
            });

            trainRecords.appendChild(card);
        });

    } catch (error) {
        trainRecords.innerHTML = `<p>${escapeHTML(error.message)}</p>`;
    }
}

if ($(TRAIN_IDS.loadBtn)) {
    $(TRAIN_IDS.loadBtn).addEventListener("click", loadTrains);
}

if (trainForm) {
    trainForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const trainId = $(TRAIN_IDS.editId).value;

        const trainData = {
            trainName: $(TRAIN_IDS.name).value.trim(),
            trainNumber: $(TRAIN_IDS.number).value.trim(),
            totalSeats: Number($(TRAIN_IDS.seats).value)
        };

        if (!trainData.trainName || !trainData.trainNumber) {
            showMsg(trainMessage, "Please fill in train name and number.", "red");
            return;
        }

        if (!(trainData.totalSeats >= 1)) {
            showMsg(trainMessage, "Total seats must be at least 1.", "red");
            return;
        }

        try {
            await adminRequest(
                trainId ? `${API_BASE}/Train/${trainId}` : `${API_BASE}/Train`,
                trainId ? "PUT" : "POST",
                trainData,
                "Train operation failed."
            );

            showMsg(
                trainMessage,
                trainId ? "Train updated successfully!" : "New train added successfully!",
                "green"
            );

            resetTrainForm();
            await loadTrains();

        } catch (error) {
            showMsg(trainMessage, error.message, "red");
            console.error(error);
        }
    });
}

async function deleteTrain(trainId) {
    if (!confirm(`Are you sure you want to delete Train ID ${trainId}?`)) return;

    try {
        await adminRequest(`${API_BASE}/Train/${trainId}`, "DELETE", null, "Unable to delete train.");

        showMsg(trainMessage, "Train deleted successfully!", "green");
        await loadTrains();

    } catch (error) {
        showMsg(trainMessage, error.message, "red");
        console.error(error);
    }
}

function resetTrainForm() {
    if (!trainForm) return;
    trainForm.reset();
    $(TRAIN_IDS.editId).value = "";
    $(TRAIN_IDS.saveBtn).textContent = "Add Train";
}

// ==================================
// ADMIN SCHEDULE MANAGEMENT
// ==================================

const managementForm = $("scheduleManagementForm");
const managementRecords = $("managementScheduleRecords");
const managementMessage = $("managementScheduleMessage");

$("managementLoadBtn").addEventListener("click", loadManagementSchedules);
$("managementClearBtn").addEventListener("click", clearManagementScheduleForm);
managementForm.addEventListener("submit", saveManagementSchedule);

async function loadManagementSchedules() {
    managementRecords.innerHTML = "<p>Loading schedules...</p>";

    try {
        // Send token if admin is logged in (works for both public and protected GET)
        const token = sessionStorage.getItem("railwayAdminToken");
        const options = token ? { headers: { "Authorization": `Bearer ${token}` } } : {};

        const data = await apiRequest(`${API_BASE}/ScheduleManagement`, options, "Could not load schedules.");
        const schedules = Array.isArray(data) ? data : [];

        if (schedules.length === 0) {
            managementRecords.innerHTML = "<p>No schedules found.</p>";
            return;
        }

        managementRecords.innerHTML = "";

        schedules.forEach(schedule => {
            // PostgreSQL may return lowercase keys; support all variants
            const id = pick(schedule, "scheduleId", "ScheduleId", "scheduleid");
            const train = pick(schedule, "trainName", "TrainName", "trainname");
            const number = pick(schedule, "trainNumber", "TrainNumber", "trainnumber");
            const source = pick(schedule, "sourceStation", "SourceStation", "sourcestation");
            const destination = pick(schedule, "destinationStation", "DestinationStation", "destinationstation");
            const fare = pick(schedule, "fare", "Fare");
            const departure = pick(schedule, "departureTime", "DepartureTime", "departuretime");
            const arrival = pick(schedule, "arrivalTime", "ArrivalTime", "arrivaltime");
            const trainId = pick(schedule, "trainId", "TrainId", "trainid");
            const sourceId = pick(schedule, "sourceStationId", "SourceStationId", "sourcestationid");
            const destinationId = pick(schedule, "destinationStationId", "DestinationStationId", "destinationstationid");

            if (id === undefined || id === null || id === "") {
                console.error("Schedule record has no ID:", schedule);
                return;
            }

            const card = document.createElement("div");
            card.className = "management-schedule-card";
            card.innerHTML = `
                <h4>${escapeHTML(train ?? "Train")} (${escapeHTML(number ?? "")})</h4>
                <p><strong>Schedule ID:</strong> ${escapeHTML(id)}</p>
                <p><strong>Route:</strong> ${escapeHTML(source ?? "")} → ${escapeHTML(destination ?? "")}</p>
                <p><strong>Departure:</strong> ${escapeHTML(formatDate(departure))}</p>
                <p><strong>Arrival:</strong> ${escapeHTML(formatDate(arrival))}</p>
                <p><strong>Fare:</strong> Rs. ${escapeHTML(fare ?? "")}</p>

                <button class="management-edit-btn" type="button">Edit</button>
                <button class="management-delete-btn" type="button">Delete</button>
            `;

            card.querySelector(".management-edit-btn").addEventListener("click", () => {
                editManagementSchedule({ id, trainId, sourceId, destinationId, departure, arrival, fare });
            });

            card.querySelector(".management-delete-btn").addEventListener("click", () => {
                deleteManagementSchedule(id);
            });

            managementRecords.appendChild(card);
        });

    } catch (error) {
        managementRecords.innerHTML = `<p>${escapeHTML(error.message)}</p>`;
    }
}

async function saveManagementSchedule(event) {
    event.preventDefault();

    const id = $("managementScheduleId").value;

    const scheduleData = {
        trainId: Number($("managementTrainId").value),
        sourceStationId: Number($("managementSourceId").value),
        destinationStationId: Number($("managementDestinationId").value),
        departureTime: $("managementDeparture").value,
        arrivalTime: $("managementArrival").value,
        fare: Number($("managementFare").value)
    };

    if (scheduleData.sourceStationId === scheduleData.destinationStationId) {
        showMsg(managementMessage, "Source and destination must be different.", "red");
        return;
    }

    if (!scheduleData.departureTime || !scheduleData.arrivalTime) {
        showMsg(managementMessage, "Please select departure and arrival time.", "red");
        return;
    }

    if (new Date(scheduleData.departureTime) >= new Date(scheduleData.arrivalTime)) {
        showMsg(managementMessage, "Arrival must be after departure.", "red");
        return;
    }

    try {
        await adminRequest(
            id ? `${API_BASE}/ScheduleManagement/${id}` : `${API_BASE}/ScheduleManagement`,
            id ? "PUT" : "POST",
            scheduleData,
            "Schedule operation failed."
        );

        showMsg(
            managementMessage,
            id ? "Schedule updated successfully!" : "Schedule added successfully!",
            "green"
        );

        clearManagementScheduleForm();
        await loadManagementSchedules();

    } catch (error) {
        showMsg(managementMessage, error.message, "red");
        console.error("SAVE SCHEDULE ERROR:", error);
    }
}

function editManagementSchedule(schedule) {
    $("managementScheduleId").value = schedule.id;
    $("managementTrainId").value = schedule.trainId ?? "";
    $("managementSourceId").value = schedule.sourceId ?? "";
    $("managementDestinationId").value = schedule.destinationId ?? "";
    $("managementDeparture").value = toLocalInput(schedule.departure);
    $("managementArrival").value = toLocalInput(schedule.arrival);
    $("managementFare").value = schedule.fare ?? "";

    $("managementSaveBtn").textContent = "Update Schedule";
    showMsg(managementMessage, "Editing schedule ID: " + schedule.id, "");

    managementForm.scrollIntoView({ behavior: "smooth" });
}

async function deleteManagementSchedule(id) {
    if (id === undefined || id === null || String(id).trim() === "") {
        showMsg(managementMessage, "Schedule ID is missing. Reload schedules and try again.", "red");
        return;
    }

    if (!confirm(`Are you sure you want to delete schedule ID ${id}?`)) return;

    try {
        await adminRequest(
            `${API_BASE}/ScheduleManagement/${encodeURIComponent(id)}`,
            "DELETE", null, "Could not delete schedule."
        );

        showMsg(managementMessage, `Schedule ID ${id} deleted successfully!`, "green");
        await loadManagementSchedules();

    } catch (error) {
        showMsg(managementMessage, error.message, "red");
        console.error("DELETE SCHEDULE ERROR:", error);
    }
}

function clearManagementScheduleForm() {
    managementForm.reset();
    $("managementScheduleId").value = "";
    $("managementSaveBtn").textContent = "Add Schedule";
}

// ==================================
// ADMIN STATION MANAGEMENT
// ==================================

const stationForm = $("stationForm");
const stationRecords = $("stationRecords");
const stationMessage = $("stationMessage");

$("loadStationsBtn").addEventListener("click", loadStations);
$("resetStationBtn").addEventListener("click", clearStationForm);
stationForm.addEventListener("submit", saveStation);

async function loadStations() {
    stationRecords.innerHTML = "<p>Loading stations...</p>";

    try {
        const token = sessionStorage.getItem("railwayAdminToken");
        const options = token ? { headers: { "Authorization": `Bearer ${token}` } } : {};

        const data = await apiRequest(`${API_BASE}/StationManagement`, options, "Could not load stations.");
        const stations = Array.isArray(data) ? data : [];

        if (stations.length === 0) {
            stationRecords.innerHTML = "<p>No stations found.</p>";
            return;
        }

        stationRecords.innerHTML = "";

        stations.forEach(station => {
            const id = pick(station, "stationId", "StationId", "stationid");
            const name = pick(station, "stationName", "StationName", "stationname");
            const city = pick(station, "city", "City");

            const card = document.createElement("div");
            card.className = "station-record-card";
            card.innerHTML = `
                <h4>${escapeHTML(name ?? "")}</h4>
                <p><strong>Station ID:</strong> ${escapeHTML(id)}</p>
                <p><strong>City:</strong> ${escapeHTML(city ?? "")}</p>
                <button type="button" class="station-edit-btn">Edit</button>
                <button type="button" class="station-delete-btn">Delete</button>
            `;

            card.querySelector(".station-edit-btn").addEventListener("click", () => {
                editStation(id, name, city);
            });

            card.querySelector(".station-delete-btn").addEventListener("click", () => {
                deleteStation(id);
            });

            stationRecords.appendChild(card);
        });

    } catch (error) {
        stationRecords.innerHTML = `<p>${escapeHTML(error.message)}</p>`;
    }
}

async function saveStation(event) {
    event.preventDefault();

    const id = $("editStationId").value;

    const stationData = {
        stationName: $("stationName").value.trim(),
        city: $("stationCity").value.trim()
    };

    if (!stationData.stationName || !stationData.city) {
        showMsg(stationMessage, "Please fill in both fields.", "red");
        return;
    }

    try {
        await adminRequest(
            id ? `${API_BASE}/StationManagement/${id}` : `${API_BASE}/StationManagement`,
            id ? "PUT" : "POST",
            stationData,
            "Station operation failed."
        );

        showMsg(
            stationMessage,
            id ? "Station updated successfully!" : "Station added successfully!",
            "green"
        );

        clearStationForm();
        await loadStations();

    } catch (error) {
        showMsg(stationMessage, error.message, "red");
        console.error("SAVE STATION ERROR:", error);
    }
}

function editStation(id, name, city) {
    $("editStationId").value = id;
    $("stationName").value = name ?? "";
    $("stationCity").value = city ?? "";

    $("saveStationBtn").textContent = "Update Station";
    showMsg(stationMessage, "Editing station ID: " + id, "");

    stationForm.scrollIntoView({ behavior: "smooth" });
}

async function deleteStation(id) {
    if (!confirm("Are you sure you want to delete this station?")) return;

    try {
        await adminRequest(
            `${API_BASE}/StationManagement/${id}`,
            "DELETE", null, "Could not delete station."
        );

        showMsg(stationMessage, "Station deleted successfully!", "green");
        await loadStations();

    } catch (error) {
        showMsg(stationMessage, error.message, "red");
        console.error("DELETE STATION ERROR:", error);
    }
}

function clearStationForm() {
    stationForm.reset();
    $("editStationId").value = "";
    $("saveStationBtn").textContent = "Add Station";
}

// ==================================
// PASSENGER LOGIN & REGISTRATION
// ==================================

const passengerRegisterForm = $("passengerRegisterForm");
const passengerLoginForm = $("passengerLoginForm");
const registerMessage = $("registerMessage");
const loginMessage = $("loginMessage");

passengerRegisterForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const passengerData = {
        passengerName: $("registerName").value.trim(),
        email: $("registerEmail").value.trim(),
        password: $("registerPassword").value
    };

    try {
        await apiRequest(`${API_BASE}/PassengerAuth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(passengerData)
        }, "Registration failed.");

        showMsg(registerMessage, "Registration successful! You can now login.", "green");
        passengerRegisterForm.reset();
        $("loginEmail").value = passengerData.email;

    } catch (error) {
        showMsg(registerMessage, error.message, "red");
    }
});

passengerLoginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const loginData = {
        email: $("loginEmail").value.trim(),
        password: $("loginPassword").value
    };

    try {
        const result = await apiRequest(`${API_BASE}/PassengerAuth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(loginData)
        }, "Login failed.");

        if (!result.token) {
            throw new Error("JWT token was not received from backend.");
        }

        sessionStorage.setItem("railwayPassenger", JSON.stringify({
            passengerId: result.passengerId,
            passengerName: result.passengerName,
            email: result.email
        }));

        sessionStorage.setItem("railwayToken", result.token);

        showMsg(loginMessage, "Login successful! Secure session started.", "green");
        passengerLoginForm.reset();
        showPassengerAccount();

    } catch (error) {
        showMsg(loginMessage, error.message, "red");
        console.error("LOGIN ERROR:", error);
    }
});

function showPassengerAccount() {
    const savedPassenger = sessionStorage.getItem("railwayPassenger");

    if (!savedPassenger) {
        $("authForms").style.display = "grid";
        $("loggedInPanel").style.display = "none";
        return;
    }

    const passenger = JSON.parse(savedPassenger);

    $("authForms").style.display = "none";
    $("loggedInPanel").style.display = "block";
    $("loggedInName").textContent = passenger.passengerName;
}

$("passengerLogoutBtn").addEventListener("click", function () {
    sessionStorage.removeItem("railwayPassenger");
    sessionStorage.removeItem("railwayToken");

    showPassengerAccount();
    showMsg(loginMessage, "You have logged out successfully.", "green");
});

showPassengerAccount();
