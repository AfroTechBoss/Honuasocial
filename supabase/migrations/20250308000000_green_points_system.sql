-- Green Points System: stores balance on profiles and history in green_points_transactions.
-- Run this migration (or scripts/create-green-points-system.sql) to enable points storage.
-- Points are awarded via add_green_points() for green posts and engagement.

-- Add green_points column to profiles table if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS green_points INTEGER DEFAULT 0;

-- Create green_points_transactions table to track all green points activities
CREATE TABLE IF NOT EXISTS green_points_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
        'earned', 'spent', 'bonus', 'refund', 'penalty', 'transfer_in', 'transfer_out'
    )),
    points INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    source VARCHAR(100) NOT NULL,
    reference_id UUID,
    reference_type VARCHAR(50),
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create green_points_earning_rules table to define how points are earned
CREATE TABLE IF NOT EXISTS green_points_earning_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    action_type VARCHAR(100) NOT NULL UNIQUE,
    points_per_action INTEGER NOT NULL,
    daily_limit INTEGER,
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Function to add green points with transaction logging
CREATE OR REPLACE FUNCTION add_green_points(
    user_id UUID,
    points INTEGER,
    transaction_type VARCHAR(50),
    source VARCHAR(100),
    reference_id UUID DEFAULT NULL,
    reference_type VARCHAR(50) DEFAULT NULL,
    description TEXT DEFAULT NULL,
    metadata JSONB DEFAULT NULL
)
RETURNS TABLE(new_balance INTEGER, transaction_id UUID) AS $$
DECLARE
    current_balance INTEGER;
    new_balance_val INTEGER;
    transaction_uuid UUID;
BEGIN
    SELECT green_points INTO current_balance FROM profiles WHERE id = user_id;
    new_balance_val := COALESCE(current_balance, 0) + points;
    IF new_balance_val < 0 THEN
        RAISE EXCEPTION 'Insufficient green points. Current balance: %, Attempted deduction: %', current_balance, ABS(points);
    END IF;
    UPDATE profiles SET green_points = new_balance_val, updated_at = NOW() WHERE id = user_id;
    INSERT INTO green_points_transactions (
        user_id, transaction_type, points, balance_after, source,
        reference_id, reference_type, description, metadata
    ) VALUES (
        user_id, transaction_type, points, new_balance_val, source,
        reference_id, reference_type, description, metadata
    ) RETURNING id INTO transaction_uuid;
    RETURN QUERY SELECT new_balance_val, transaction_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's green points balance
CREATE OR REPLACE FUNCTION get_green_points_balance(user_id UUID)
RETURNS INTEGER AS $$
DECLARE balance INTEGER;
BEGIN
    SELECT green_points INTO balance FROM profiles WHERE id = user_id;
    RETURN COALESCE(balance, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's green points transaction history
CREATE OR REPLACE FUNCTION get_green_points_history(
    user_id UUID,
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE(
    id UUID,
    transaction_type VARCHAR(50),
    points INTEGER,
    balance_after INTEGER,
    source VARCHAR(100),
    reference_id UUID,
    reference_type VARCHAR(50),
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.transaction_type, t.points, t.balance_after, t.source,
           t.reference_id, t.reference_type, t.description, t.metadata, t.created_at
    FROM green_points_transactions t
    WHERE t.user_id = get_green_points_history.user_id
    ORDER BY t.created_at DESC
    LIMIT limit_count OFFSET offset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Default earning rules (idempotent)
INSERT INTO green_points_earning_rules (action_type, points_per_action, daily_limit, description) VALUES
('daily_login', 10, 10, 'Daily login bonus'),
('post_creation', 25, 100, 'Creating a sustainability-focused post'),
('comment_creation', 5, 50, 'Commenting on posts'),
('like_post', 2, 20, 'Liking posts'),
('share_post', 10, 50, 'Sharing posts'),
('complete_profile', 100, 100, 'Completing user profile'),
('invite_friend', 50, 500, 'Inviting friends to join'),
('marketplace_purchase', 20, NULL, 'Making sustainable marketplace purchases'),
('marketplace_sale', 0, NULL, 'Marketplace sale reward (5% of sale value)'),
('recycle_action', 30, 150, 'Logging recycling activities'),
('energy_saving', 40, 200, 'Logging energy-saving actions'),
('sustainable_transport', 35, 175, 'Using sustainable transportation'),
('plant_tree', 100, 500, 'Planting trees (verified)'),
('reduce_waste', 25, 125, 'Waste reduction activities'),
('water_conservation', 30, 150, 'Water conservation actions'),
('green_purchase', 50, 250, 'Purchasing eco-friendly products')
ON CONFLICT (action_type) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_green_points_transactions_user_id ON green_points_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_green_points_transactions_created_at ON green_points_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_green_points_transactions_source ON green_points_transactions(source);
CREATE INDEX IF NOT EXISTS idx_green_points_transactions_reference ON green_points_transactions(reference_id, reference_type);
CREATE INDEX IF NOT EXISTS idx_profiles_green_points ON profiles(green_points);

-- RLS
ALTER TABLE green_points_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE green_points_earning_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own green points transactions" ON green_points_transactions;
CREATE POLICY "Users can view their own green points transactions" ON green_points_transactions
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert green points transactions" ON green_points_transactions;
CREATE POLICY "System can insert green points transactions" ON green_points_transactions
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Everyone can view earning rules" ON green_points_earning_rules;
CREATE POLICY "Everyone can view earning rules" ON green_points_earning_rules
    FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "Only admins can modify earning rules" ON green_points_earning_rules;
CREATE POLICY "Only admins can modify earning rules" ON green_points_earning_rules
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Permissions
GRANT EXECUTE ON FUNCTION add_green_points(UUID, INTEGER, VARCHAR(50), VARCHAR(100), UUID, VARCHAR(50), TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION get_green_points_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_green_points_history(UUID, INTEGER, INTEGER) TO authenticated;

-- Trigger for updated_at on earning rules
CREATE OR REPLACE FUNCTION update_green_points_earning_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_green_points_earning_rules_updated_at ON green_points_earning_rules;
CREATE TRIGGER update_green_points_earning_rules_updated_at
    BEFORE UPDATE ON green_points_earning_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_green_points_earning_rules_updated_at();
