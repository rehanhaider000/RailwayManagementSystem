const API_BASE = "https://localhost:7163/api";
// ADMIN AUTHORIZATION HEADER
function getAdminHeaders(includeJson = false) {
    const token = sessionStorage.getItem("railwayAdminToken");

    if (!token) {
        throw new Error("Please login as Admin first.");
    }

    const headers = {
        "Authorization": `Bearer ${token}`
    };

    if (includeJson) {
        headers["Content-Type"] = "application/json";
    }

    return headers;
}

const scheduleList = document.getElementById("scheduleList");
const scheduleSelect = document.getElementById("scheduleSelect");
const seatSelect = document.getElementById("seatSelect");
const bookingForm = document.getElementById("bookingForm");
const bookingMessage = document.getElementById("bookingMessage");

// Load train schedules from backend
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

// Load available seats for selected schedule
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
            seatSelect.innerHTML =
                '<option value="">No available seats</option>';
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
        seatSelect.innerHTML =
            '<option value="">Unable to load seats</option>';
        console.error(error);
    }
}

// When schedule changes, load its available seats
scheduleSelect.addEventListener("change", () => {
    loadAvailableSeats(scheduleSelect.value);
});


// Create a secure booking using JWT
bookingForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const token = sessionStorage.getItem("railwayToken");
    const savedPassenger = sessionStorage.getItem("railwayPassenger");

    if (!token || !savedPassenger) {
        bookingMessage.textContent = "Please login first to book a ticket.";
        bookingMessage.style.color = "red";
        return;
    }

    if (!scheduleSelect.value || !seatSelect.value) {
        bookingMessage.textContent = "Please select a schedule and seat.";
        bookingMessage.style.color = "red";
        return;
    }

    const bookingData = {
        passengerName: document.getElementById("passengerName").value.trim(),
        passengerEmail: document.getElementById("passengerEmail").value.trim(),
        scheduleId: Number(scheduleSelect.value),
        seatId: Number(seatSelect.value)
    };

    if (!bookingData.scheduleId || !bookingData.seatId) {
        bookingMessage.textContent = "Please select a valid schedule and seat.";
        bookingMessage.style.color = "red";
        return;
    }

    try {
        bookingMessage.textContent = "Processing your secure booking...";
        bookingMessage.style.color = "#17243b";

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
            throw new Error(
                result.message || result.title || "Booking failed."
            );
        }

        const bookingId = result.bookingId ?? result.BookingId;

        bookingMessage.textContent = bookingId
            ? `Booking successful! Your Booking ID is ${bookingId}.`
            : "Your ticket has been booked successfully!";

        bookingMessage.style.color = "green";

        bookingForm.reset();
        seatSelect.innerHTML = '<option value="">Select a seat</option>';

    } catch (error) {
        bookingMessage.textContent = error.message;
        bookingMessage.style.color = "red";
        console.error("BOOKING ERROR:", error);
    }
});


// Prevent HTML injection in displayed text
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

// Format date/time values
function formatDate(value) {
    if (!value) return "Not available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString();
}

// Start loading schedules
loadSchedules();

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

        // Show logged-in passenger email
        document.getElementById("searchEmail").value = passenger.email;

        resultDiv.innerHTML = "<p>Loading your bookings...</p>";

        const response = await fetch(
            `${API_BASE}/MyBookings/mine`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || data.title || "Unable to load bookings."
            );
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

    const confirmed = confirm(
        `Are you sure you want to cancel Booking ID ${bookingId}?`
    );

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(
            `${API_BASE}/BookingManagement/cancel/${bookingId}`,
            {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message || result.title || "Ticket cancellation failed."
            );
        }

        alert("Your ticket has been cancelled successfully!");

        document.getElementById("searchEmail").value = email;
        await loadMyBookings();

    } catch (error) {
        alert(error.message);
        console.error("CANCELLATION ERROR:", error);
    }
}

        // Refresh booking history
       


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
adminLoginForm.addEventListener("submit", async function(event) {
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
            headers: {
                "Content-Type": "application/json"
            },
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
adminLogoutBtn.addEventListener("click", function() {
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
        const headers = {
            "Authorization": `Bearer ${token}`
        };

        const [statsResponse, bookingsResponse] = await Promise.all([
            fetch(`${API_BASE}/Admin/dashboard`, { headers }),
            fetch(`${API_BASE}/Admin/all-bookings`, { headers })
        ]);

        if (
            statsResponse.status === 401 ||
            statsResponse.status === 403 ||
            bookingsResponse.status === 401 ||
            bookingsResponse.status === 403
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
            <div class="stat-card">
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

        // Delete button functionality
        bookingsDiv.querySelectorAll(".admin-delete-btn").forEach(button => {
            button.addEventListener("click", async () => {

                const bookingId = button.dataset.bookingId;

                const confirmDelete = confirm(
                    `Are you sure you want to permanently delete Booking #${bookingId}?`
                );

                if (!confirmDelete) return;

                button.disabled = true;
                button.textContent = "Deleting...";

                try {
                    const response = await fetch(
                        `${API_BASE}/Admin/delete-booking/${bookingId}`,
                        {
                            method: "DELETE",
                            headers: {
                                "Authorization": `Bearer ${token}`
                            }
                        }
                    );

                    const resultText = await response.text();

                    let result = {};
                    try {
                        result = resultText ? JSON.parse(resultText) : {};
                    } catch {
                        result = { message: resultText };
                    }

                    if (!response.ok) {
                        throw new Error(
                            result.message || "Unable to delete booking."
                        );
                    }

                    alert(result.message || "Booking deleted successfully!");

                    // Refresh dashboard and bookings
                    await loadAdminDashboard();

                } catch (error) {
                    alert(error.message);
                    console.error("DELETE BOOKING ERROR:", error);

                    button.disabled = false;
                    button.textContent = "Delete";
                }
            });
        });

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


// Add or update train
trainForm.addEventListener("submit", async function(event) {
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
        const response = await fetch(
            `${API_BASE}/Train/${trainId}`,
           {
    method: "DELETE",
    headers: getAdminHeaders()
}
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || "Unable to delete train.");
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

document.getElementById("managementLoadBtn").addEventListener("click", loadManagementSchedules);

document.getElementById("managementClearBtn").addEventListener("click", clearManagementScheduleForm);

managementForm.addEventListener("submit", saveManagementSchedule);


// LOAD ALL SCHEDULES
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
                <h4>${escapeHTML(String(train ?? "Train"))} (${escapeHTML(String(number ?? ""))})</h4>
                <p><strong>Schedule ID:</strong> ${id}</p>
                <p><strong>Route:</strong> ${escapeHTML(String(source ?? ""))} → ${escapeHTML(String(destination ?? ""))}</p>
                <p><strong>Departure:</strong> ${formatDate(departure)}</p>
                <p><strong>Arrival:</strong> ${formatDate(arrival)}</p>
                <p><strong>Fare:</strong> Rs. ${fare}</p>

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

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || result.title || "Schedule operation failed.");
        }

        managementMessage.textContent = id
            ? "Schedule updated successfully!"
            : "Schedule added successfully!";

        clearManagementScheduleForm();
        await loadManagementSchedules();

    } catch (error) {
        managementMessage.textContent = error.message;
    }
}


// EDIT SCHEDULE
function editManagementSchedule(schedule) {
    document.getElementById("managementScheduleId").value = schedule.id;
    document.getElementById("managementTrainId").value = schedule.trainId;
    document.getElementById("managementSourceId").value = schedule.sourceId;
    document.getElementById("managementDestinationId").value = schedule.destinationId;
    document.getElementById("managementDeparture").value =
        new Date(schedule.departure).toISOString().slice(0, 16);
    document.getElementById("managementArrival").value =
        new Date(schedule.arrival).toISOString().slice(0, 16);
    document.getElementById("managementFare").value = schedule.fare;

    document.getElementById("managementSaveBtn").textContent = "Update Schedule";
    managementMessage.textContent = "Editing schedule ID: " + schedule.id;

    managementForm.scrollIntoView({ behavior: "smooth" });
}


// DELETE SCHEDULE
async function deleteManagementSchedule(id) {
    if (!confirm("Are you sure you want to delete this schedule?")) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/ScheduleManagement/${id}`, {
           method: "DELETE",
headers: getAdminHeaders()
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || result.title || "Could not delete schedule.");
        }

        managementMessage.textContent = "Schedule deleted successfully!";
        await loadManagementSchedules();

    } catch (error) {
        managementMessage.textContent = error.message;
    }
}


// CLEAR FORM
function clearManagementScheduleForm() {
    managementForm.reset();
    document.getElementById("managementScheduleId").value = "";
    document.getElementById("managementSaveBtn").textContent = "Add Schedule";
}// ==================================
// SAFE ERROR READER (works for JSON, plain text, and empty bodies)
async function readApiError(response, fallback) {
    if (response.status === 401) {
        return "Session expired or not logged in. Please login as Admin again.";
    }
    if (response.status === 403) {
        return "You do not have Admin permission for this action.";
    }

    const text = await response.text();
    if (!text) return `${fallback} (HTTP ${response.status})`;

    try {
        const json = JSON.parse(text);
        if (typeof json === "string") return json;
        return json.message || json.title || `${fallback} (HTTP ${response.status})`;
    } catch {
        return text;
    }
}

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
            const id = station.stationId ?? station.StationId ?? station.stationid;
            const name = station.stationName ?? station.StationName ?? station.stationname;
            const city = station.city ?? station.City;

            const card = document.createElement("div");
            card.className = "station-record-card";

            card.innerHTML = `
                <h4>${escapeHTML(String(name ?? ""))}</h4>
                <p><strong>Station ID:</strong> ${id}</p>
                <p><strong>City:</strong> ${escapeHTML(String(city ?? ""))}</p>
                <button type="button" class="station-edit-btn">Edit</button>
                <button type="button" class="station-delete-btn">Delete</button>
            `;

            card.querySelector(".station-edit-btn")
                .addEventListener("click", () => {
                    editStation(id, name, city);
                });

            card.querySelector(".station-delete-btn")
                .addEventListener("click", () => {
                    deleteStation(id);
                });

            stationRecords.appendChild(card);
        });

    } catch (error) {
        stationRecords.innerHTML =
            `<p>${escapeHTML(error.message)}</p>`;
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
    }
}


// EDIT STATION
function editStation(id, name, city) {
    if (id === undefined || id === null || id === "undefined") {
        stationMessage.textContent = "Station ID missing from API response. Check the Network tab.";
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
    }
}


// CLEAR FORM
function clearStationForm() {
    stationForm.reset();

    document.getElementById("editStationId").value = "";
    document.getElementById("saveStationBtn").textContent = "Add Station";
}// ==================================
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

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Registration failed.");
        }

        registerMessage.textContent = "Registration successful! You can now login.";
        registerMessage.style.color = "green";

        passengerRegisterForm.reset();

        document.getElementById("loginEmail").value = passengerData.email;

    } catch (error) {
        registerMessage.textContent = error.message;
        registerMessage.style.color = "red";
    }
});


// LOGIN PASSENGER

// LOGIN PASSENGER WITH JWT TOKEN

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

        const result = await response.json();

        console.log("LOGIN API RESPONSE:", result);

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

        // Verify token was saved
        console.log("JWT TOKEN SAVED:", !!sessionStorage.getItem("railwayToken"));

        loginMessage.textContent = "Login successful! Secure session started.";
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

// LOGOUT PASSENGER
document.getElementById("passengerLogoutBtn")
    .addEventListener("click", function () {

        sessionStorage.removeItem("railwayPassenger");
        sessionStorage.removeItem("railwayToken");

        showPassengerAccount();

        loginMessage.textContent = "You have logged out successfully.";
        loginMessage.style.color = "green";
    });

// RESTORE LOGIN DISPLAY WHEN PAGE LOADS
showPassengerAccount();
