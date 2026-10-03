// Utils.h  -  small helper functions (string / JSON helpers)
#pragma once
#include <string>
#include <vector>
#include <map>
#include <sstream>
#include <iomanip>
#include <algorithm>
#include <cctype>
#include "Exceptions.h"

namespace util {

inline std::string trim(const std::string& s) {
    size_t a = 0, b = s.size();
    while (a < b && std::isspace((unsigned char)s[a])) a++;
    while (b > a && std::isspace((unsigned char)s[b - 1])) b--;
    return s.substr(a, b - a);
}

inline std::string lower(std::string s) {
    for (auto& c : s) c = (char)std::tolower((unsigned char)c);
    return s;
}

inline std::vector<std::string> split(const std::string& s, char d) {
    std::vector<std::string> out;
    std::string cur;
    std::stringstream ss(s);
    while (std::getline(ss, cur, d)) out.push_back(cur);
    if (!s.empty() && s.back() == d) out.push_back("");
    return out;
}

inline int toInt(const std::string& s, const std::string& field) {
    try {
        size_t pos = 0;
        int v = std::stoi(trim(s), &pos);
        if (pos != trim(s).size()) throw std::invalid_argument("x");
        return v;
    } catch (...) {
        throw ValidationException(field + " must be a whole number");
    }
}

inline double toDouble(const std::string& s, const std::string& field) {
    try {
        size_t pos = 0;
        double v = std::stod(trim(s), &pos);
        if (pos != trim(s).size()) throw std::invalid_argument("x");
        return v;
    } catch (...) {
        throw ValidationException(field + " must be a number");
    }
}

inline std::string money(double v) {
    std::ostringstream o;
    o << std::fixed << std::setprecision(2) << v;
    return o.str();
}

// escape a string so it can be put inside "..." in JSON
inline std::string esc(const std::string& s) {
    std::string o;
    for (char c : s) {
        switch (c) {
            case '"': o += "\\\""; break;
            case '\\': o += "\\\\"; break;
            case '\n': o += "\\n"; break;
            case '\r': break;
            case '\t': o += "\\t"; break;
            default: o += c;
        }
    }
    return o;
}

// "name": "value" helpers
inline std::string jstr(const std::string& k, const std::string& v) { return "\"" + k + "\":\"" + esc(v) + "\""; }
inline std::string jnum(const std::string& k, double v)             { return "\"" + k + "\":" + money(v); }
inline std::string jint(const std::string& k, long v)               { return "\"" + k + "\":" + std::to_string(v); }

// very small parser for flat JSON bodies like {"a":"x","b":5}
inline std::map<std::string, std::string> parseFlatJson(const std::string& s) {
    std::map<std::string, std::string> m;
    size_t i = 0, n = s.size();
    auto skip = [&]() { while (i < n && std::isspace((unsigned char)s[i])) i++; };
    auto readStr = [&]() {
        std::string out;
        i++;
        while (i < n && s[i] != '"') {
            if (s[i] == '\\' && i + 1 < n) {
                i++;
                char c = s[i];
                out += (c == 'n') ? '\n' : (c == 't') ? '\t' : c;
            } else out += s[i];
            i++;
        }
        i++;
        return out;
    };
    skip();
    if (i >= n || s[i] != '{') return m;
    i++;
    while (i < n) {
        skip();
        if (i >= n || s[i] == '}') break;
        if (s[i] == ',') { i++; continue; }
        if (s[i] != '"') break;
        std::string key = readStr();
        skip();
        if (i < n && s[i] == ':') i++;
        skip();
        std::string val;
        if (i < n && s[i] == '"') val = readStr();
        else { while (i < n && s[i] != ',' && s[i] != '}') val += s[i++]; val = trim(val); }
        m[key] = val;
    }
    return m;
}

} // namespace util
