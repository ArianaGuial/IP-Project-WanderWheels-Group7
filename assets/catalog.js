"use strict";

async function loadVehicleCatalog() {
  const grid = document.querySelector(".vehicles");
  const cards = [...grid.querySelectorAll(".vehicle-card")];
  const original = new Map(cards.map((card) => [card.querySelector("h3").textContent, card]));
  const format = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  });

  try {
    const response = await fetch("/api/rentals/fleet");
    if (!response.ok) {
      throw new Error("Live availability is temporarily unavailable.");
    }
    const fleet = await response.json();
    for (const card of cards) card.remove();
    for (const car of fleet) {
      const known = original.get(car.name);
      const card = known || cards[0].cloneNode(true);
      const image = card.querySelector("img");
      const description = card.querySelector(".description");
      if (!known) {
        image.src = "/img/display.png";
        image.alt = "";
        description.textContent = "Check availability for your rental dates.";
      }
      card.querySelector("h3").textContent = car.name;
      card.querySelector(".price").textContent = format.format(car.daily_rate);
      card.querySelector(".type-car p").textContent = car.category;
      const control = card.querySelector("button");
      control.removeAttribute("onclick");
      control.addEventListener("click", () => {
        openModal(
          car.name,
          car.category,
          description.textContent.trim(),
          image.src,
          format.format(car.daily_rate),
        );
        document.getElementById("bookButton").dataset.vehicle = car.id;
      });
      grid.append(card);
    }
    if (!fleet.length) {
      const empty = document.createElement("p");
      empty.textContent = "No vehicles are available. Contact us for help planning your rental.";
      grid.append(empty);
    }
  } catch {
    const message = document.createElement("p");
    message.setAttribute("role", "status");
    message.textContent =
      "Live availability is temporarily unavailable. Displayed vehicles are examples.";
    grid.before(message);
  }
}

loadVehicleCatalog();
