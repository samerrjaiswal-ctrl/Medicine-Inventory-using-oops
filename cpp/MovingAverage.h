// MovingAverage.h  -  Unit 6: Generics / Templates
#pragma once
#include <deque>
#include <cstddef>

template <typename T>
class MovingAverage {
    std::deque<T> window;
    std::size_t maxSize;
public:
    explicit MovingAverage(std::size_t size) : maxSize(size) {}
    void add(T value) {
        window.push_back(value);
        if (window.size() > maxSize) window.pop_front();
    }
    double average() const {
        if (window.empty()) return 0.0;
        double sum = 0;
        for (const T& v : window) sum += v;
        return sum / window.size();
    }
};
