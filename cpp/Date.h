// Date.h  -  Unit 2/3: class, constructors, operator overloading, static methods
#pragma once
#include <string>

class Date {
    int year, month, day;
    static long toDays(int y, int m, int d);          // days since 1970-01-01
    static void fromDays(long z, int& y, int& m, int& d);
public:
    Date();                                            // default = today
    Date(int y, int m, int d);                         // throws ValidationException if invalid
    static Date today();                               // static method (uses MIS_TODAY env for demo/testing)
    static Date parse(const std::string& iso);         // "YYYY-MM-DD"
    static Date fromDayNumber(long z);

    long dayNumber() const { return toDays(year, month, day); }
    Date addDays(long n) const;
    std::string toString() const;                      // YYYY-MM-DD   (stored in files / API)
    std::string toDisplay() const;                     // DD/MM/YYYY   (printed on bill)

    // operator overloading
    long operator-(const Date& o) const { return dayNumber() - o.dayNumber(); }
    bool operator<(const Date& o) const { return dayNumber() < o.dayNumber(); }
    bool operator==(const Date& o) const { return dayNumber() == o.dayNumber(); }
    bool operator<=(const Date& o) const { return dayNumber() <= o.dayNumber(); }
};
