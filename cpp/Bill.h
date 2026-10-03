// Bill.h  -  BillItem + Bill classes (static member, operator+=, friend operator<<)
#pragma once
#include <string>
#include <vector>
#include <ostream>
#include "Date.h"

class BillItem {
    std::string medicine, batchNo;
    int quantity;
    double price;                       // unit price
public:
    BillItem(const std::string& med = "", const std::string& batch = "", int qty = 0, double price = 0);
    const std::string& getMedicine() const { return medicine; }
    const std::string& getBatchNo() const { return batchNo; }
    int getQuantity() const { return quantity; }
    double getPrice() const { return price; }
    double total() const { return price * quantity; }
};

class Bill {
    std::string id;
    Date date;
    std::string buyer;
    std::vector<BillItem> items;
    static int counter;                 // static data member - last used bill number
public:
    Bill(const std::string& id, const Date& date, const std::string& buyer);

    static std::string generateId();                 // static method -> B001, B002 ...
    static void setCounter(int n) { counter = n; }
    static int getCounter() { return counter; }
    static int numberFromId(const std::string& id);

    const std::string& getId() const { return id; }
    const Date& getDate() const { return date; }
    const std::string& getBuyer() const { return buyer; }
    const std::vector<BillItem>& getItems() const { return items; }
    double total() const;

    Bill& operator+=(const BillItem& item) { items.push_back(item); return *this; }   // operator overloading

    std::string toJson() const;
    friend std::ostream& operator<<(std::ostream& os, const Bill& b);                  // printable bill
};
