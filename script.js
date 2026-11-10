const API_BASE = "https://localhost:7163/api";

// ==================================
// HAMBURGER MENU
// ==================================
(function () {
    const menuToggle = document.getElementById("menuToggle");
    const navLinks = document.getElementById("navLinks");

    if (!menuToggle || !navLinks) return;

    function closeMenu() {
        navLinks.classList.remove("open");
        menuToggle.classList.remove("active");
        menuToggle.setAttribute("aria-expanded", "false");
    }

    menuToggle.addEventListener("click", function (event) {
        event.stopPropagation();
        const isOpen = navLinks.classList.toggle("open");
        menuToggle.classList.toggle("active", isOpen);
        menuToggle.setAttribute("aria-expanded", String(isOpen));
    });

    navLinks.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", closeMenu);
    });

    document.addEventListener("click", function (event) {
        if (!navLinks.contains(event.target) && !menuToggle.contains(event.target)) {
            closeMenu();
        }
    });

})();

// ==================================
// HELPERS
// ==================================
const COLOR_OK = "#6FE39B";
const COLOR_ERR = "#FF8A8A";
const COLOR_INFO = "#D8CBB3";

function setMessage(element, text, color) {
    element.textContent = text;
    element.style.color = color || COLOR_INFO;
}

// Admin Authorization header
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

// Prevent HTML injection
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

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString();
}

// Convert a date to value for <input type="datetime-local"> (local time)
function toLocalInputValue(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    const pad = n => String(n).padStart(2, "0");

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
           `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// ==================================
// DOM REFERENCES
// ==================================
const scheduleList = document.getElementById("scheduleList");
const scheduleSelect = document.getElementById("scheduleSelect");
const seatSelect = document.getElementById("seatSelect");
const bookingForm = document.getElementById("bookingForm");
const bookingMessage = document.getElementById("bookingMessage");

// ==================================
// PUBLIC SCHEDULES
// ==================================
async function loadSchedules() {
    try {
        const response = await fetch(`${API_BASE}/Schedule/merge-sort`);

        if (!response.ok) {
            throw new Error("Could not load train schedules.");
        }

        const data = await response.json();

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
            const id = schedule.scheduleId ?? schedule.ScheduleId;
            const train = schedule.trainName ?? schedule.TrainName ?? "Train";
            const number = schedule.trainNumber ?? schedule.TrainNumber ?? "";
            const source = schedule.sourceStation ?? schedule.SourceStation ?? "";
            const destination = schedule.destinationStation ?? schedule.DestinationStation ?? "";
            const departure = schedule.departureTime ?? schedule.DepartureTime ?? "";
            const arrival = schedule.arrivalTime ?? schedule.ArrivalTime ?? "";
            const fare = schedule.fare ?? schedule.Fare ?? 0;

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
        scheduleList.textContent =
            "Unable to load schedules. Make sure your backend is running.";
        console.error(error);
    }
}

// Load available seats for the selected schedule
async function loadAvailableSeats(scheduleId) {
    seatSelect.innerHTML = '<option value="">Loading seats...</option>';

    if (!scheduleId) {
        seatSelect.innerHTML = '<option value="">Select a seat</option>';
        return;
    }

    try {
        const response = await fetch(
            `${API_BASE}/BookingManagement/available-seats/${scheduleId}`
        );

        if (!response.ok) {
            throw new Error("Could not load available seats.");
        }

        const data = await response.json();

        const seats = Array.isArray(data)
            ? data
            : (data.availableSeats || data.AvailableSeats || []);

        seatSelect.innerHTML = '<option value="">Select a seat</option>';

        if (!Array.isArray(seats) || seats.length === 0) {
            seatSelect.innerHTML = '<option value="">No available seats</option>';
            return;
        }

        seats.forEach(seat => {
            const seatId = seat.seatId ?? seat.SeatId;
            const seatNumber = seat.seatNumber ?? seat.SeatNumber;

            const option = document.createElement("option");
            option.value = seatId;
            option.textContent = `Seat ${seatNumber}`;
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

// ==================================
// CREATE BOOKING (JWT)
// ==================================
bookingForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const token = sessionStorage.getItem("railwayToken");
    const savedPassenger = sessionStorage.getItem("railwayPassenger");

    if (!token || !savedPassenger) {
        setMessage(bookingMessage, "Please login first to book a ticket.", COLOR_ERR);
        return;
    }

    if (!scheduleSelect.value || !seatSelect.value) {
        setMessage(bookingMessage, "Please select a schedule and seat.", COLOR_ERR);
        return;
    }

    const bookingData = {
        passengerName: document.getElementById("passengerName").value.trim(),
        passengerEmail: document.getElementById("passengerEmail").value.trim(),
        scheduleId: Number(scheduleSelect.value),
        seatId: Number(seatSelect.value)
    };

    if (!bookingData.scheduleId || !bookingData.seatId) {
        setMessage(bookingMessage, "Please select a valid schedule and seat.", COLOR_ERR);
        return;
    }

    try {
        setMessage(bookingMessage, "Processing your secure booking...", COLOR_INFO);

        const response = await fetch(`${API_BASE}/BookingManagement/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(bookingData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || result.title || "Booking failed.");
        }

        const bookingId = result.bookingId ?? result.BookingId;

        setMessage(
            bookingMessage,
            bookingId
                ? `Booking successful! Your Booking ID is ${bookingId}.`
                : "Your ticket has been booked successfully!",
            COLOR_OK
        );

        bookingForm.reset();
        seatSelect.innerHTML = '<option value="">Select a seat</option>';

    } catch (error) {
        setMessage(bookingMessage, error.message, COLOR_ERR);
        console.error("BOOKING ERROR:", error);
    }
});

loadSchedules();

// ==================================
// MY BOOKINGS
// ==================================
document.getElementById("searchBookingsBtn").addEventListener("click", loadMyBookings);

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

        const data = await response.json();

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
                <p><strong>Status:</strong>
                    <span class="booking-status">${escapeHTML(status)}</span>
                </p>
            `;

            if (String(status).toLowerCase() === "confirmed") {
                const cancelButton = document.createElement("button");
                cancelButton.type = "button";
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

        const result = await response.json();

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
// ADMIN LOGIN (JWT)
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

adminLoginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const loginData = {
        email: document.getElementById("adminEmail").value.trim(),
        password: document.getElementById("adminPassword").value
    };

    try {
        adminLoginMessage.textContent = "Checking admin credentials...";
        adminLoginMessage.style.color = "#D8CBB3";

        const response = await fetch(`${API_BASE}/AdminAuth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(loginData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Admin login failed.");
        }

        if (!result.token || result.role !== "Admin") {
            throw new Error("Valid admin token was not received.");
        }

        sessionStorage.setItem("railwayAdminToken", result.token);

        adminLoginMessage.textContent = "Admin login successful!";
        adminLoginMessage.style.color = "#6FE39B";

        adminLoginForm.reset();
        showAdminAccount();

    } catch (error) {
        adminLoginMessage.textContent = error.message;
        adminLoginMessage.style.color = "#FF8A8A";
        console.error("ADMIN LOGIN ERROR:", error);
    }
});

adminLogoutBtn.addEventListener("click", function () {
    sessionStorage.removeItem("railwayAdminToken");

    showAdminAccount();

    adminLoginMessage.textContent = "Admin logged out successfully.";
    adminLoginMessage.style.color = "#6FE39B";
});

// ==================================
// ADMIN DASHBOARD
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

        if (
            statsResponse.status === 401 || statsResponse.status === 403 ||
            bookingsResponse.status === 401 || bookingsResponse.status === 403
        ) {
            throw new Error("Admin session expired or unauthorized. Please login again.");
        }

        if (!statsResponse.ok || !bookingsResponse.ok) {
            throw new Error("Unable to load admin data.");
        }

        const statsData = await statsResponse.json();
        const bookingsData = await bookingsResponse.json();

        const stats = statsData.statistics || {};

        const totalTrains = stats.totalTrains ?? stats.TotalTrains ?? 0;
        const totalSchedules = stats.totalSchedules ?? stats.TotalSchedules ?? 0;
        const totalBookings = stats.totalBookings ?? stats.TotalBookings ?? 0;
        const confirmed = stats.confirmedBookings ?? stats.ConfirmedBookings ?? 0;
        const cancelled = stats.cancelledBookings ?? stats.CancelledBookings ?? 0;

        statsDiv.innerHTML = `
            <div class="stat-card"><h3>Total Trains</h3><p>${escapeHTML(totalTrains)}</p></div>
            <div class="stat-card"><h3>Total Schedules</h3><p>${escapeHTML(totalSchedules)}</p></div>
            <div class="stat-card"><h3>Total Bookings</h3><p>${escapeHTML(totalBookings)}</p></div>
            <div class="stat-card"><h3>Confirmed Bookings</h3><p>${escapeHTML(confirmed)}</p></div>
            <div class="stat-card"><h3>Cancelled Bookings</h3><p>${escapeHTML(cancelled)}</p></div>
        `;

        const bookings = bookingsData.bookings || [];

        if (bookings.length === 0) {
            bookingsDiv.innerHTML = "<p>No booking records found.</p>";
            return;
        }

        const rows = bookings.map(booking => {
            const get = (lower, upper) => booking[lower] ?? booking[upper] ?? "";
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

showAdminAccount();

// ==================================
// ADMIN TRAIN MANAGEMENT
// ==================================
const trainForm = document.getElementById("trainForm");
const trainRecords = document.getElementById("trainRecords");
const trainMessage = document.getElementById("trainMessage");

document.getElementById("loadTrainsBtn").addEventListener("click", loadTrains);
document.getElementById("resetTrainBtn").addEventListener("click", resetTrainForm);

async function loadTrains() {
    trainRecords.innerHTML = "<p>Loading trains...</p>";

    try {
        const response = await fetch(`${API_BASE}/Train`, {
            headers: getAdminHeaders()
        });

        const data = await response.json().catch(() => []);

        if (!response.ok) {
            throw new Error(data.message || "Could not load trains.");
        }

        const trains = Array.isArray(data) ? data : (data.trains || data.Trains || []);

        if (trains.length === 0) {
            trainRecords.innerHTML = "<p>No trains found.</p>";
            return;
        }

        trainRecords.innerHTML = "";

        trains.forEach(train => {
            const id = train.trainId ?? train.TrainId;
            const name = train.trainName ?? train.TrainName ?? "";
            const number = train.trainNumber ?? train.TrainNumber ?? "";
            const seats = train.totalSeats ?? train.TotalSeats ?? "";

            const card = document.createElement("div");
            card.className = "train-record-card";

            card.innerHTML = `
                <h4>${escapeHTML(name)}</h4>
                <p><strong>Train ID:</strong> ${escapeHTML(id)}</p>
                <p><strong>Train Number:</strong> ${escapeHTML(number)}</p>
                <p><strong>Total Seats:</strong> ${escapeHTML(seats)}</p>
                <button type="button" class="edit-btn">Edit</button>
                <button type="button" class="delete-btn">Delete</button>
            `;

            card.querySelector(".edit-btn").addEventListener("click", () => {
                editTrain(id, name, number, seats);
            });

            card.querySelector(".delete-btn").addEventListener("click", () => {
                deleteTrain(id);
            });

            trainRecords.appendChild(card);
        });

    } catch (error) {
        trainRecords.innerHTML = `<p>${escapeHTML(error.message)}</p>`;
        console.error(error);
    }
}

function editTrain(id, name, number, seats) {
    document.getElementById("editTrainId").value = id;
    document.getElementById("trainName").value = name;
    document.getElementById("trainNumber").value = number;
    document.getElementById("totalSeats").value = seats;

    document.getElementById("saveTrainBtn").textContent = "Update Train";
    setMessage(trainMessage, "Editing train ID: " + id, COLOR_INFO);

    trainForm.scrollIntoView({ behavior: "smooth" });
}

trainForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const trainId = document.getElementById("editTrainId").value;

    const trainData = {
        trainName: document.getElementById("trainName").value.trim(),
        trainNumber: document.getElementById("trainNumber").value.trim(),
        totalSeats: Number(document.getElementById("totalSeats").value)
    };

    if (trainData.totalSeats < 1) {
        setMessage(trainMessage, "Total seats must be at least 1.", COLOR_ERR);
        return;
    }

    const url = trainId ? `${API_BASE}/Train/${trainId}` : `${API_BASE}/Train`;
    const method = trainId ? "PUT" : "POST";

    try {
        const response = await fetch(url, {
            method: method,
            headers: getAdminHeaders(true),
            body: JSON.stringify(trainData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || "Train operation failed.");
        }

        setMessage(
            trainMessage,
            trainId ? "Train updated successfully!" : "New train added successfully!",
            COLOR_OK
        );

        resetTrainForm(false);
        await loadTrains();

    } catch (error) {
        setMessage(trainMessage, error.message, COLOR_ERR);
        console.error(error);
    }
});

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
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || "Unable to delete train.");
        }

        setMessage(trainMessage, "Train deleted successfully!", COLOR_OK);
        await loadTrains();

    } catch (error) {
        setMessage(trainMessage, error.message, COLOR_ERR);
        console.error(error);
    }
}

function resetTrainForm(clearMessage = true) {
    trainForm.reset();
    document.getElementById("editTrainId").value = "";
    document.getElementById("saveTrainBtn").textContent = "Add Train";

    if (clearMessage === true) {
        trainMessage.textContent = "";
    }
}

// ==================================
// ADMIN SCHEDULE MANAGEMENT
// ==================================
const managementForm = document.getElementById("scheduleManagementForm");
const managementRecords = document.getElementById("managementScheduleRecords");
const managementMessage = document.getElementById("managementScheduleMessage");

document.getElementById("managementLoadBtn").addEventListener("click", loadManagementSchedules);
document.getElementById("managementClearBtn").addEventListener("click", () => clearManagementScheduleForm());
managementForm.addEventListener("submit", saveManagementSchedule);

async function loadManagementSchedules() {
    managementRecords.innerHTML = "<p>Loading schedules...</p>";

    try {
        const response = await fetch(`${API_BASE}/ScheduleManagement`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Could not load schedules.");
        }

        const schedules = Array.isArray(data) ? data : [];

        if (schedules.length === 0) {
            managementRecords.innerHTML = "<p>No schedules found.</p>";
            return;
        }

        managementRecords.innerHTML = "";

        schedules.forEach(schedule => {
            const id = schedule.scheduleId ?? schedule.ScheduleId;
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
    }
}

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
        setMessage(managementMessage, "Source and destination must be different.", COLOR_ERR);
        return;
    }

    if (new Date(scheduleData.departureTime) >= new Date(scheduleData.arrivalTime)) {
        setMessage(managementMessage, "Arrival must be after departure.", COLOR_ERR);
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

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.message || result.title || "Schedule operation failed.");
        }

        setMessage(
            managementMessage,
            id ? "Schedule updated successfully!" : "Schedule added successfully!",
            COLOR_OK
        );

        clearManagementScheduleForm(false);
        await loadManagementSchedules();

    } catch (error) {
        setMessage(managementMessage, error.message, COLOR_ERR);
    }
}

function editManagementSchedule(schedule) {
    document.getElementById("managementScheduleId").value = schedule.id;
    document.getElementById("managementTrainId").value = schedule.trainId;
    document.getElementById("managementSourceId").value = schedule.sourceId;
    document.getElementById("managementDestinationId").value = schedule.destinationId;
    document.getElementById("managementDeparture").value = toLocalInputValue(schedule.departure);
    document.getElementById("managementArrival").value = toLocalInputValue(schedule.arrival);
    document.getElementById("managementFare").value = schedule.fare;

    document.getElementById("managementSaveBtn").textContent = "Update Schedule";
    setMessage(managementMessage, "Editing schedule ID: " + schedule.id, COLOR_INFO);

    managementForm.scrollIntoView({ behavior: "smooth" });
}

async function deleteManagementSchedule(id) {
    if (!confirm("Are you sure you want to delete this schedule?")) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/ScheduleManagement/${id}`, {
            method: "DELETE",
            headers: getAdminHeaders()
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.message || result.title || "Could not delete schedule.");
        }

        setMessage(managementMessage, "Schedule deleted successfully!", COLOR_OK);
        await loadManagementSchedules();

    } catch (error) {
        setMessage(managementMessage, error.message, COLOR_ERR);
    }
}

function clearManagementScheduleForm(clearMessage = true) {
    managementForm.reset();
    document.getElementById("managementScheduleId").value = "";
    document.getElementById("managementSaveBtn").textContent = "Add Schedule";

    if (clearMessage === true) {
        managementMessage.textContent = "";
    }
}

// ==================================
// ADMIN STATION MANAGEMENT
// ==================================
const stationForm = document.getElementById("stationForm");
const stationRecords = document.getElementById("stationRecords");
const stationMessage = document.getElementById("stationMessage");

document.getElementById("loadStationsBtn").addEventListener("click", loadStations);
document.getElementById("resetStationBtn").addEventListener("click", () => clearStationForm());
stationForm.addEventListener("submit", saveStation);

async function loadStations() {
    stationRecords.innerHTML = "<p>Loading stations...</p>";

    try {
        const response = await fetch(`${API_BASE}/StationManagement`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Could not load stations.");
        }

        const stations = Array.isArray(data) ? data : [];

        if (stations.length === 0) {
            stationRecords.innerHTML = "<p>No stations found.</p>";
            return;
        }

        stationRecords.innerHTML = "";

        stations.forEach(station => {
            const id = station.stationId ?? station.StationId;
            const name = station.stationName ?? station.StationName;
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

    const id = document.getElementById("editStationId").value;

    const stationData = {
        stationName: document.getElementById("stationName").value.trim(),
        city: document.getElementById("stationCity").value.trim()
    };

    if (!stationData.stationName || !stationData.city) {
        setMessage(stationMessage, "Please fill in both fields.", COLOR_ERR);
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

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.message || result.title || "Station operation failed.");
        }

        setMessage(
            stationMessage,
            id ? "Station updated successfully!" : "Station added successfully!",
            COLOR_OK
        );

        clearStationForm(false);
        await loadStations();

    } catch (error) {
        setMessage(stationMessage, error.message, COLOR_ERR);
    }
}

function editStation(id, name, city) {
    document.getElementById("editStationId").value = id;
    document.getElementById("stationName").value = name;
    document.getElementById("stationCity").value = city;

    document.getElementById("saveStationBtn").textContent = "Update Station";
    setMessage(stationMessage, "Editing station ID: " + id, COLOR_INFO);

    stationForm.scrollIntoView({ behavior: "smooth" });
}

async function deleteStation(id) {
    if (!confirm("Are you sure you want to delete this station?")) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/StationManagement/${id}`, {
            method: "DELETE",
            headers: getAdminHeaders()
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.message || result.title || "Could not delete station.");
        }

        setMessage(stationMessage, "Station deleted successfully!", COLOR_OK);
        await loadStations();

    } catch (error) {
        setMessage(stationMessage, error.message, COLOR_ERR);
    }
}

function clearStationForm(clearMessage = true) {
    stationForm.reset();

    document.getElementById("editStationId").value = "";
    document.getElementById("saveStationBtn").textContent = "Add Station";

    if (clearMessage === true) {
        stationMessage.textContent = "";
    }
}

// ==================================
// PASSENGER LOGIN & REGISTRATION
// ==================================
const passengerRegisterForm = document.getElementById("passengerRegisterForm");
const passengerLoginForm = document.getElementById("passengerLoginForm");
const registerMessage = document.getElementById("registerMessage");
const loginMessage = document.getElementById("loginMessage");

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
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(passengerData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Registration failed.");
        }

        setMessage(registerMessage, "Registration successful! You can now login.", COLOR_OK);

        passengerRegisterForm.reset();
        document.getElementById("loginEmail").value = passengerData.email;

    } catch (error) {
        setMessage(registerMessage, error.message, COLOR_ERR);
    }
});

passengerLoginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const loginData = {
        email: document.getElementById("loginEmail").value.trim(),
        password: document.getElementById("loginPassword").value
    };

    try {
        const response = await fetch(`${API_BASE}/PassengerAuth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(loginData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Login failed.");
        }

        if (!result.token) {
            throw new Error("JWT token was not received from backend.");
        }

        sessionStorage.setItem("railwayPassenger", JSON.stringify({
            passengerId: result.passengerId,
            passengerName: result.passengerName,
            email: result.email
        }));

        sessionStorage.setItem("railwayToken", result.token);

        setMessage(loginMessage, "Login successful! Secure session started.", COLOR_OK);

        passengerLoginForm.reset();
        showPassengerAccount();

    } catch (error) {
        setMessage(loginMessage, error.message, COLOR_ERR);
        console.error("LOGIN ERROR:", error);
    }
});

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
    document.getElementById("loggedInName").textContent = passenger.passengerName;
}

document.getElementById("passengerLogoutBtn").addEventListener("click", function () {
    sessionStorage.removeItem("railwayPassenger");
    sessionStorage.removeItem("railwayToken");

    showPassengerAccount();

    setMessage(loginMessage, "You have logged out successfully.", COLOR_OK);
});

// Restore login display on page load
showPassengerAccount();
