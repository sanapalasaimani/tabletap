import csv
import random
import datetime
import math
import os

# Set random seed for reproducible and consistent data
random.seed(42)

START_DATE = datetime.date(2025, 10, 1)
END_DATE = datetime.date(2026, 9, 30)

MENU_ITEMS = [
    {'id': 'm1', 'name': 'Chicken Biryani', 'price': 220, 'category': 'Main Course', 'isVeg': False, 'spicy': 2, 'base_prep': 22},
    {'id': 'm2', 'name': 'Paneer Butter Masala', 'price': 180, 'category': 'Main Course', 'isVeg': True, 'spicy': 1, 'base_prep': 18},
    {'id': 'm3', 'name': 'Veg Pulao', 'price': 150, 'category': 'Main Course', 'isVeg': True, 'spicy': 1, 'base_prep': 16},
    {'id': 'm4', 'name': 'Chilli Chicken', 'price': 200, 'category': 'Main Course', 'isVeg': False, 'spicy': 3, 'base_prep': 18},
    {'id': 'm5', 'name': 'Fish Curry', 'price': 220, 'category': 'Main Course', 'isVeg': False, 'spicy': 2, 'base_prep': 22},
    {'id': 'm6', 'name': 'Dal Tadka', 'price': 140, 'category': 'Main Course', 'isVeg': True, 'spicy': 1, 'base_prep': 12},
    {'id': 'm7', 'name': 'Masala Dosa', 'price': 80, 'category': 'Breakfast', 'isVeg': True, 'spicy': 1, 'base_prep': 9},
    {'id': 'm8', 'name': 'Cold Coffee', 'price': 120, 'category': 'Beverages', 'isVeg': True, 'spicy': 0, 'base_prep': 5},
    {'id': 'm9', 'name': 'French Fries', 'price': 90, 'category': 'Breakfast', 'isVeg': True, 'spicy': 0, 'base_prep': 9},
    {'id': 'm10', 'name': 'Cheese Pizza', 'price': 180, 'category': 'Breakfast', 'isVeg': True, 'spicy': 0, 'base_prep': 17},
    {'id': 'm11', 'name': 'Veg Sandwich', 'price': 120, 'category': 'Breakfast', 'isVeg': True, 'spicy': 0, 'base_prep': 9},
    {'id': 'm12', 'name': 'Lemon Ice Tea', 'price': 80, 'category': 'Beverages', 'isVeg': True, 'spicy': 0, 'base_prep': 5},
    {'id': 'm13', 'name': 'Gulab Jamun', 'price': 60, 'category': 'Desserts', 'isVeg': True, 'spicy': 0, 'base_prep': 5},
    {'id': 'm14', 'name': 'Chocolate Brownie', 'price': 120, 'category': 'Desserts', 'isVeg': True, 'spicy': 0, 'base_prep': 8}
]

WAITERS = ['EMP-101', 'EMP-102', 'EMP-103', 'EMP-104', 'EMP-105', 'EMP-106']
PAYMENT_METHODS = ['UPI', 'UPI', 'UPI', 'Card', 'Card', 'Cash'] # UPI dominant in India

# Key Indian holidays and celebration windows
HOLIDAYS = {
    datetime.date(2025, 10, 2): 'Gandhi Jayanti',
    datetime.date(2025, 10, 20): 'Diwali Season',
    datetime.date(2025, 10, 21): 'Diwali Day',
    datetime.date(2025, 11, 5): 'Guru Nanak Jayanti',
    datetime.date(2025, 12, 24): 'Christmas Eve',
    datetime.date(2025, 12, 25): 'Christmas',
    datetime.date(2025, 12, 31): 'New Year Eve',
    datetime.date(2026, 1, 1): 'New Year Day',
    datetime.date(2026, 1, 14): 'Pongal / Sankranti',
    datetime.date(2026, 1, 26): 'Republic Day',
    datetime.date(2026, 3, 4): 'Holi',
    datetime.date(2026, 4, 14): 'Tamil New Year / Baisakhi',
    datetime.date(2026, 5, 1): 'May Day',
    datetime.date(2026, 8, 15): 'Independence Day'
}

# Unique pool of 1200 customer IDs
CUSTOMER_POOL = [f"CUST-{1000 + i}" for i in range(1200)]
customer_visit_tracker = {cid: 0 for cid in CUSTOMER_POOL}

orders_data = []
daily_analytics_data = []

cur_date = START_DATE
order_counter = 1

print(f"Generating 1-Year DineSmart dataset from {START_DATE} to {END_DATE}...")

while cur_date <= END_DATE:
    dow = cur_date.weekday() # 0 = Monday, 6 = Sunday
    is_weekend = 1 if dow in [4, 5, 6] else 0 # Fri, Sat, Sun are busy
    is_holiday = 1 if cur_date in HOLIDAYS else 0
    holiday_name = HOLIDAYS.get(cur_date, 'None')

    # Base orders per day
    if is_weekend:
        daily_order_target = random.randint(70, 95)
    else:
        daily_order_target = random.randint(40, 60)
        
    if is_holiday:
        daily_order_target = int(daily_order_target * 1.35)

    daily_revenue = 0.0
    daily_items_sold = 0
    daily_veg_items = 0
    daily_nonveg_items = 0
    daily_prep_times = []
    daily_ratings = []
    hourly_counts = {h: 0 for h in range(8, 23)}

    for _ in range(daily_order_target):
        # Time distribution across day
        # Breakfast: 8-11, Lunch: 12-15, Snacks: 16-18, Dinner: 19-22
        rand_val = random.random()
        if rand_val < 0.18:
            hour = random.choice([8, 9, 10])
            meal_session = 'Breakfast'
        elif rand_val < 0.52:
            hour = random.choice([12, 13, 14])
            meal_session = 'Lunch'
        elif rand_val < 0.68:
            hour = random.choice([16, 17, 18])
            meal_session = 'Snacks'
        else:
            hour = random.choice([19, 20, 21, 22])
            meal_session = 'Dinner'

        minute = random.randint(0, 59)
        second = random.randint(0, 59)
        order_time = datetime.datetime.combine(cur_date, datetime.time(hour, minute, second))
        hourly_counts[hour] += 1

        # Table & guest count
        table_id = random.randint(1, 20)
        guest_count = random.choices([1, 2, 3, 4, 5, 6], weights=[10, 40, 20, 20, 5, 5])[0]

        # Customer selection
        # 60% chance repeat customer, 40% random
        cid = random.choice(CUSTOMER_POOL)
        customer_visit_tracker[cid] += 1
        visits = customer_visit_tracker[cid]

        if visits > 15:
            loyalty_tier = 'Platinum'
        elif visits > 8:
            loyalty_tier = 'Gold'
        elif visits > 3:
            loyalty_tier = 'Silver'
        else:
            loyalty_tier = 'Bronze'

        # Select menu items depending on meal session
        if meal_session == 'Breakfast':
            eligible = [m for m in MENU_ITEMS if m['category'] in ['Breakfast', 'Beverages']]
        elif meal_session == 'Lunch':
            eligible = [m for m in MENU_ITEMS if m['category'] in ['Main Course', 'Beverages', 'Desserts']]
        elif meal_session == 'Snacks':
            eligible = [m for m in MENU_ITEMS if m['category'] in ['Breakfast', 'Beverages', 'Desserts']]
        else: # Dinner
            eligible = [m for m in MENU_ITEMS]

        # Order quantity (proportional to guest count)
        num_dishes = min(max(1, guest_count + random.choice([0, 1, -1])), 5)
        selected_dishes = random.choices(eligible, k=num_dishes)

        subtotal = 0.0
        max_base_prep = 0
        has_veg = 0
        has_nonveg = 0
        dish_summary_list = []

        for dish in selected_dishes:
            subtotal += dish['price']
            if dish['base_prep'] > max_base_prep:
                max_base_prep = dish['base_prep']
            if dish['isVeg']:
                has_veg = 1
                daily_veg_items += 1
            else:
                has_nonveg = 1
                daily_nonveg_items += 1
            daily_items_sold += 1
            dish_summary_list.append(dish['name'])

        items_summary = ", ".join(dish_summary_list)
        item_count = len(selected_dishes)

        # Discount logic
        discount_applied = 0.0
        discount_percent = 0.0
        if loyalty_tier == 'Platinum' or subtotal > 600:
            discount_percent = random.choice([10.0, 15.0])
            discount_applied = round(subtotal * (discount_percent / 100.0), 2)
        elif loyalty_tier == 'Gold' or (is_weekend and random.random() < 0.25):
            discount_percent = 5.0
            discount_applied = round(subtotal * 0.05, 2)

        # Tax: 5% GST on food in India
        taxable_amount = max(0.0, subtotal - discount_applied)
        gst_tax = round(taxable_amount * 0.05, 2)

        # Tip
        tip_amount = random.choices([0.0, 20.0, 50.0, 100.0], weights=[60, 25, 12, 3])[0]
        total_bill = round(taxable_amount + gst_tax + tip_amount, 2)

        # Kitchen Congestion & Prep Time calculation
        # Congestion increases during peak lunch (13-14) & peak dinner (20-21)
        is_rush = 1 if hour in [13, 14, 20, 21] else 0
        queue_length = random.randint(5, 12) if is_rush else random.randint(1, 4)
        
        # Real prep time model formula
        prep_delay = round(queue_length * 0.8 + (1.5 if not has_veg else 0.5) + random.uniform(-1.5, 3.5), 1)
        prep_delay = max(0.0, prep_delay)
        actual_prep_time = round(max_base_prep + prep_delay, 1)

        daily_prep_times.append(actual_prep_time)

        # Customer feedback rating (1.0 to 5.0)
        # Slower orders receive slightly lower ratings
        if prep_delay > 8:
            rating = round(random.uniform(3.0, 4.2), 1)
        else:
            rating = round(random.choices([4.5, 4.8, 5.0, 4.0], weights=[35, 35, 20, 10])[0], 1)
        daily_ratings.append(rating)

        waiter_id = random.choice(WAITERS)
        pay_method = random.choice(PAYMENT_METHODS)

        order_id = f"ORD-{cur_date.strftime('%Y%m%d')}-{order_counter:04d}"
        order_counter += 1

        orders_data.append({
            'order_id': order_id,
            'order_timestamp': order_time.strftime('%Y-%m-%d %H:%M:%S'),
            'date': cur_date.strftime('%Y-%m-%d'),
            'hour_of_day': hour,
            'day_of_week': dow,
            'day_name': cur_date.strftime('%A'),
            'month': cur_date.month,
            'month_name': cur_date.strftime('%B'),
            'is_weekend': is_weekend,
            'meal_session': meal_session,
            'is_holiday': is_holiday,
            'holiday_name': holiday_name,
            'table_id': table_id,
            'guest_count': guest_count,
            'customer_id': cid,
            'customer_visit_count': visits,
            'loyalty_tier': loyalty_tier,
            'item_count': item_count,
            'items_summary': items_summary,
            'has_veg': has_veg,
            'has_non_veg': has_nonveg,
            'subtotal': subtotal,
            'discount_applied': discount_applied,
            'discount_percent': discount_percent,
            'gst_tax': gst_tax,
            'tip_amount': tip_amount,
            'total_bill': total_bill,
            'payment_method': pay_method,
            'waiter_id': waiter_id,
            'kitchen_queue_length': queue_length,
            'base_prep_time_min': max_base_prep,
            'actual_prep_time_min': actual_prep_time,
            'prep_delay_min': prep_delay,
            'customer_rating': rating
        })

        daily_revenue += total_bill

    # Save daily analytics record
    peak_hour = max(hourly_counts, key=hourly_counts.get)
    avg_prep = round(sum(daily_prep_times) / len(daily_prep_times), 1) if daily_prep_times else 0
    avg_rating = round(sum(daily_ratings) / len(daily_ratings), 2) if daily_ratings else 5.0

    daily_analytics_data.append({
        'date': cur_date.strftime('%Y-%m-%d'),
        'day_name': cur_date.strftime('%A'),
        'month_name': cur_date.strftime('%B'),
        'is_weekend': is_weekend,
        'is_holiday': is_holiday,
        'holiday_name': holiday_name,
        'total_orders': daily_order_target,
        'total_revenue': round(daily_revenue, 2),
        'avg_order_value': round(daily_revenue / daily_order_target, 2),
        'total_items_sold': daily_items_sold,
        'veg_items_count': daily_veg_items,
        'nonveg_items_count': daily_nonveg_items,
        'peak_rush_hour': peak_hour,
        'avg_prep_time_min': avg_prep,
        'avg_customer_rating': avg_rating
    })

    cur_date += datetime.timedelta(days=1)

# Write Order-Level Dataset CSV
output_dir = os.path.join(os.getcwd(), 'ml_dataset')
os.makedirs(output_dir, exist_ok=True)

order_csv_path = os.path.join(output_dir, 'dinesmart_orders_1year_dataset.csv')
with open(order_csv_path, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=list(orders_data[0].keys()))
    writer.writeheader()
    writer.writerows(orders_data)

# Write Daily Analytics Dataset CSV
daily_csv_path = os.path.join(output_dir, 'dinesmart_daily_analytics_1year.csv')
with open(daily_csv_path, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=list(daily_analytics_data[0].keys()))
    writer.writeheader()
    writer.writerows(daily_analytics_data)

print(f"SUCCESS!")
print(f"1. Order-Level Dataset: {order_csv_path} ({len(orders_data):,} rows)")
print(f"2. Daily Aggregated Dataset: {daily_csv_path} ({len(daily_analytics_data):,} rows)")
