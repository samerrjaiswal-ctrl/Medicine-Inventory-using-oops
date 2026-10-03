#include "Date.h"
#include "Exceptions.h"
#include <ctime>
#include <cstdlib>
#include <cstdio>

long Date::toDays(int y, int m, int d) {
    y -= m <= 2;
    long era = (y >= 0 ? y : y - 399) / 400;
    unsigned yoe = (unsigned)(y - era * 400);
    unsigned doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1;
    unsigned doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    return era * 146097 + (long)doe - 719468;
}

void Date::fromDays(long z, int& y, int& m, int& d) {
    z += 719468;
    long era = (z >= 0 ? z : z - 146096) / 146097;
    unsigned doe = (unsigned)(z - era * 146097);
    unsigned yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    y = (int)(yoe + era * 400);
    unsigned doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    unsigned mp = (5 * doy + 2) / 153;
    d = (int)(doy - (153 * mp + 2) / 5 + 1);
    m = (int)(mp < 10 ? mp + 3 : mp - 9);
    y += (m <= 2);
}

Date::Date() {
    Date t = Date::today();
    year = t.year; month = t.month; day = t.day;
}

Date::Date(int y, int m, int d) : year(y), month(m), day(d) {
    int yy, mm, dd;
    if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) throw ValidationException("Invalid date");
    fromDays(toDays(y, m, d), yy, mm, dd);
    if (yy != y || mm != m || dd != d) throw ValidationException("Invalid date");
}

Date Date::today() {
    const char* env = std::getenv("MIS_TODAY");      // e.g. MIS_TODAY=2026-10-03 for demo
    if (env && *env) return Date::parse(env);
    std::time_t t = std::time(nullptr);
    std::tm* lt = std::localtime(&t);
    return Date(lt->tm_year + 1900, lt->tm_mon + 1, lt->tm_mday);
}

Date Date::parse(const std::string& s) {
    int y, m, d;
    char extra;
    if (std::sscanf(s.c_str(), "%d-%d-%d%c", &y, &m, &d, &extra) != 3)
        throw ValidationException("Date must be in YYYY-MM-DD format");
    return Date(y, m, d);
}

Date Date::fromDayNumber(long z) {
    int y, m, d;
    fromDays(z, y, m, d);
    return Date(y, m, d);
}

Date Date::addDays(long n) const { return fromDayNumber(dayNumber() + n); }

std::string Date::toString() const {
    char buf[16];
    std::snprintf(buf, sizeof buf, "%04d-%02d-%02d", year, month, day);
    return buf;
}

std::string Date::toDisplay() const {
    char buf[16];
    std::snprintf(buf, sizeof buf, "%02d/%02d/%04d", day, month, year);
    return buf;
}
