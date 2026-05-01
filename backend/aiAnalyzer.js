const categories = {
    food: ['kfc', 'mcdonalds', 'restaurant', 'burger', 'pizza', 'lunch', 'dinner', 'mess', 'swiggy', 'zomato', 'blinkit', 'zepto', 'groceries', 'supermarket'],
    travel: ['uber', 'ola', 'auto', 'metro', 'bus', 'train', 'irctc', 'petrol', 'diesel', 'fuel', 'flight', 'indigo', 'airindia', 'rapido'],
    rent: ['rent', 'hostel', 'pg', 'accommodation', 'room'],
    entertainment: ['movie', 'netflix', 'amazon prime', 'hotstar', 'gaming', 'pub', 'club', 'party', 'spotify', 'youtube premium'],
    shopping: ['amazon', 'flipkart', 'myntra', 'ajio', 'clothes', 'shoes', 'electronics', 'gadget', 'iphone', 'laptop', 'shopping'],
    bills: ['electricity', 'water', 'recharge', 'wifi', 'internet', 'jio', 'airtel', 'vi', 'gas'],
    salary: ['salary', 'allowance', 'credit', 'payment from', 'stipend'],
    freelancing: ['upwork', 'fiverr', 'client', 'project', 'freelance'],
    bus_pass: ['bus pass', 'monthly pass', 'rtc', 'bmtc'],
    stationery: ['book', 'pen', 'notebook', 'stationery', 'printout', 'xerox', 'photocopy', 'assignment'],
    lunch_outside: ['canteen', 'outside lunch', 'snacks', 'tea', 'coffee'],
    fuel: ['petrol pump', 'gas station', 'fuel bill', 'indian oil', 'bharat petroleum', 'hp']
};

/**
 * AI Categorizer - Rule-Based (Fast & Local)
 * @param {string} description User provided description
 * @param {string} type 'expense' or 'income'
 */
function autoCategorize(description, type) {
    if (!description) return null;
    const desc = description.toLowerCase();

    // Check all categories
    for (const [category, keywords] of Object.entries(categories)) {
        if (keywords.some(kw => desc.includes(kw))) {
            return category;
        }
    }

    // Default if not found
    return type === 'income' ? 'other' : 'other';
}

/**
 * AI Insight Generator - Logic-Based
 */
function generateInsights(transactions, budgets, user) {
    if (!transactions || transactions.length === 0) {
        return {
            status: 'empty',
            message: "Add your first transaction to get smart predictive insights!",
            insights: []
        };
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const daysPassed = now.getDate();
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const expenses = transactions.filter(t => t.type === 'expense');
    const income = transactions.filter(t => t.type === 'income');

    // 1. Current Month Analysis
    const currentMonthExpenses = expenses.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const totalSpentThisMonth = currentMonthExpenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const avgSpentPerDay = daysPassed > 0 ? totalSpentThisMonth / daysPassed : 0;
    const estimatedMonthlySpend = avgSpentPerDay * totalDaysInMonth;

    // 2. Trend vs Last Month
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const lastMonthExpenses = expenses.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
    });
    const totalSpentLastMonth = lastMonthExpenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const insights = [];

    // --- Prediction Insight ---
    if (totalSpentThisMonth > 0) {
        insights.push({
            type: 'prediction',
            title: 'Budget Prediction',
            value: `₹${estimatedMonthlySpend.toFixed(0)}`,
            message: `At your current pace, you'll spend ₹${estimatedMonthlySpend.toFixed(0)} by the end of ${now.toLocaleString('default', { month: 'long' })}.`,
            status: totalSpentLastMonth > 0 && estimatedMonthlySpend > totalSpentLastMonth * 1.1 ? 'warning' : 'good'
        });
    }

    // --- Trend Insight ---
    const diff = totalSpentLastMonth > 0 ? ((totalSpentThisMonth - totalSpentLastMonth) / totalSpentLastMonth) * 100 : 0;
    if (totalSpentLastMonth > 0) {
        insights.push({
            type: 'trend',
            title: 'Monthly Trend',
            value: `${Math.abs(diff).toFixed(1)}% ${diff > 0 ? 'Increase' : 'Decrease'}`,
            message: diff > 0
                ? `You've spent ₹${(totalSpentThisMonth - totalSpentLastMonth).toFixed(0)} more than last month.`
                : `Great! You've spent ₹${(totalSpentLastMonth - totalSpentThisMonth).toFixed(0)} less than last month.`,
            status: diff > 10 ? 'warning' : 'good'
        });
    }

    // --- Category Analysis ---
    const currentCategories = currentMonthExpenses.reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
        return acc;
    }, {});

    const sortedCats = Object.entries(currentCategories).sort((a, b) => b[1] - a[1]);
    if (sortedCats.length > 0) {
        const [topCat, topVal] = sortedCats[0];
        const advice = getCategoryAdvice(topCat);
        insights.push({
            type: 'advice',
            title: `Smart Advice: ${topCat.charAt(0).toUpperCase() + topCat.slice(1)}`,
            message: `You've spent ₹${topVal.toFixed(0)} on ${topCat} so far. ${advice}`,
            status: 'info'
        });
    }

    // --- Anomaly Detection ---
    const recentTx = expenses.slice(0, 10);
    const avgRecentTx = recentTx.length > 0 ? recentTx.reduce((sum, t) => sum + Math.abs(t.amount), 0) / recentTx.length : 0;
    const anomalies = currentMonthExpenses.filter(t => Math.abs(t.amount) > avgRecentTx * 2.5 && Math.abs(t.amount) > 1000);

    if (anomalies.length > 0) {
        insights.push({
            type: 'anomaly',
            title: 'Unusual Expense Detected',
            message: `Found a transaction for ₹${Math.abs(anomalies[0].amount)} (${anomalies[0].description}) that is much higher than your normal spend.`,
            status: 'warning'
        });
    }

    return {
        status: 'success',
        summary: {
            pace: estimatedMonthlySpend,
            lastMonthTotal: totalSpentLastMonth,
            thisMonthTotal: totalSpentThisMonth
        },
        insights
    };
}

function getCategoryAdvice(category) {
    const adviceMap = {
        food: "You're spending quite a bit on food/dining. Trying a 'Home Cooked Week' could save you up to 25%.",
        travel: "Transport costs are rising. Consider carpooling or checking monthly pass options for commuting.",
        shopping: "Shopping is your highest category. Consider the '24-hour rule' (wait 24h before buying) to avoid impulsive purchases.",
        entertainment: "Subscription costs can add up. Review your streaming services and cancel unused ones.",
        rent: "Rent is a fixed cost, but you may save on electricity/utilities by being more mindful of usage.",
        bills: "Review your recurring bills; sometimes switching providers or plans can save a few hundreds monthly.",
        bus_pass: "Your daily commute pass is active. Always ensure you renew before the month ends to avoid daily ad-hoc ticket costs.",
        stationery: "Consider buying common stationery in bulk or using digital notes where accepted to reduce semester costs.",
        lunch_outside: "Eating outside daily adds up! As a day scholar, bringing a packed lunch can significantly extend your monthly runway.",
        fuel: "Consider carpooling with other day scholars or taking public transport a few days a week to lower heavy fuel costs.",
        other: "Misc. expenses are high. Try specifically tracking these to see where the money is leaking."
    };
    return adviceMap[category] || "Keep an eye on this category to maintain a healthy balance.";
}

module.exports = {
    autoCategorize,
    generateInsights
};
