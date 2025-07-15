import React from "react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Search, Bell } from "lucide-react";

const data = [
  {
    title: "Mercedes Benz GLE",
    price: "$4500.00/3 Weeks",
    image: "/cars/benz-gle.jpg",
  },
  {
    title: "Daminas Hall",
    price: "$3000.00/1 Day",
    image: "/venues/hall.jpg",
  },
  {
    title: "Canon P42 Camera",
    price: "$1500.00/2 Weeks",
    image: "/cameras/canon.jpg",
  },
  {
    title: "Acoustic Guitar",
    price: "$780.00/1 Month",
    image: "/instruments/guitar.jpg",
  },
  {
    title: "Singer Sewing Machine",
    price: "$2015.38/1 Year",
    image: "/machines/sewing.jpg",
  },
  {
    title: "Mercedes Benz GLE",
    price: "$1500.00/3 Weeks",
    image: "/cars/benz-gle2.jpg",
  },
  {
    title: "McLauren Tractor",
    price: "$10000.00/4 Months",
    image: "/tractors/mclauren.jpg",
  },
  {
    title: "1 Bedroom Self Contain",
    price: "$7500.10/6 Months",
    image: "/homes/selfcontain.jpg",
  },
];

export default function RentifyLanding() {
  return (
    <div className="bg-gray-50 min-h-screen font-sans">
      <header className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-6 h-6" />
          <span className="text-xl font-semibold">Good Morning <span className="text-purple-600">James</span></span>
        </div>
        <div className="flex items-center gap-4">
          <a href="#" className="text-purple-600 font-medium">Special offers</a>
          <Search className="w-6 h-6" />
        </div>
      </header>

      <section className="px-4">
        <div className="rounded-2xl overflow-hidden">
          <img
            src="/furniture/italian-set.jpg"
            alt="Italian Furniture"
            className="w-full h-48 object-cover"
          />
          <div className="-mt-16 px-4">
            <div className="bg-white bg-opacity-90 p-3 rounded-lg shadow">
              <h2 className="text-lg font-bold">Full Set Italian Furniture</h2>
              <p className="text-sm text-gray-700">$600.00/1YR</p>
            </div>
          </div>
        </div>
      </section>

      <div className="px-4 mt-4 flex items-center justify-between">
        <div className="flex gap-2 overflow-auto">
          {["Cars", "Hotels", "Appartments", "Bikes", "Camera"].map((cat) => (
            <Button key={cat} variant="outline" className="rounded-full text-sm">
              {cat}
            </Button>
          ))}
        </div>
        <span className="text-sm text-purple-600">Categories</span>
      </div>

      <h3 className="px-4 mt-6 text-lg font-semibold">What you may like</h3>

      <section className="grid grid-cols-2 gap-4 px-4 py-4">
        {data.map((item, i) => (
          <Card key={i} className="rounded-xl shadow-md">
            <img
              src={item.image}
              alt={item.title}
              className="w-full h-32 object-cover rounded-t-xl"
            />
            <CardContent className="p-3">
              <h4 className="font-semibold text-sm">{item.title}</h4>
              <p className="text-xs text-gray-600">{item.price}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
