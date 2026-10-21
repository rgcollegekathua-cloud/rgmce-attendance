export const IST_TIME_ZONE = 'Asia/Kolkata';
export const DEFAULT_TIMING = {
    officialArrival: '09:30',
    officialDeparture: '17:00',
    graceMinutes: 15,
    weekendDays: [0],
    holidays: [],
    allowWeekendAttendance: false,
    minimumWorkingMinutes: 180
};
export const DEFAULT_APP_SETTINGS = {
    ...DEFAULT_TIMING,
    collegeName: 'Rajiv Gandhi Memorial College of Education',
    collegePlace: 'Kathua, Jammu & Kashmir'
};
