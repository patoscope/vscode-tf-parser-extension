terraform {
  required_providers {
    snowflake = {
      source  = "Snowflake-Labs/snowflake"
      version = "~> 0.84"
    }
  }
}

provider "snowflake" {
  # Configuration will be provided via environment variables or terraform.tfvars
  # SNOWFLAKE_USER, SNOWFLAKE_PASSWORD, SNOWFLAKE_ACCOUNT, etc.
}
resource "snowflake_table" "table_users" {
  name     = "users"

  column {
    name = "id"
    type = "NUMBER(38,0)"
    nullable = false
  }

  column {
    name = "username"
    type = "VARCHAR(50)"
    nullable = false
  }

  column {
    name = "email"
    type = "VARCHAR(255)"
  }

  column {
    name = "created_at"
    type = "TIMESTAMP_NTZ"
    default {
      expression = "CURRENT_TIMESTAMP()"
    }
  }

  column {
    name = "is_active"
    type = "BOOLEAN"
    default {
      expression = "TRUE"
    }
  }
}

resource "snowflake_table" "table_sales_products" {
  name     = "products"
  schema   = "sales"

  column {
    name = "product_id"
    type = "NUMBER(38,0)"
    nullable = false
    comment = "Unique product identifier"
  }

  column {
    name = "product_name"
    type = "VARCHAR(200)"
    nullable = false
    comment = "Product display name"
  }

  column {
    name = "category"
    type = "VARCHAR(100)"
  }

  column {
    name = "price"
    type = "NUMBER(10,2)"
    default {
      expression = "0.00"
    }
  }

  column {
    name = "inventory_count"
    type = "NUMBER(38,0)"
    default {
      expression = "0"
    }
  }

  column {
    name = "description"
    type = "VARCHAR(16777216)"
  }

  column {
    name = "created_at"
    type = "TIMESTAMP_NTZ"
    default {
      expression = "CURRENT_TIMESTAMP()"
    }
  }
}

resource "snowflake_table" "table_analytics_user_events" {
  name     = "user_events"
  schema   = "analytics"
  cluster_by = ["event_date", "user_id"]

  column {
    name = "event_date"
    type = "DATE"
    nullable = false
  }

  column {
    name = "user_id"
    type = "NUMBER(38,0)"
    nullable = false
  }

  column {
    name = "event_type"
    type = "VARCHAR(50)"
    nullable = false
  }

  column {
    name = "properties"
    type = "VARIANT"
  }

  column {
    name = "created_at"
    type = "TIMESTAMP_NTZ"
    default {
      expression = "CURRENT_TIMESTAMP()"
    }
  }
}

resource "snowflake_view" "view_active_users" {
  name     = "active_users"
  statement = <<-EOT
SELECT id, username, email, created_at
    FROM users
    WHERE is_active = TRUE
EOT
}

resource "snowflake_view" "view_reporting_sales_summary" {
  name     = "sales_summary"
  schema   = "reporting"
  is_secure = true
  statement = <<-EOT
SELECT 
        p.category,
        COUNT(*) as product_count,
        AVG(p.price) as avg_price,
        SUM(p.inventory_count) as total_inventory
    FROM sales.products p
    GROUP BY p.category
    ORDER BY product_count DESC
EOT
}

resource "snowflake_procedure" "procedure_update_user_status" {
  name     = "update_user_status"
  language = "SQL"
  return_type = "STRING"

  argument {
    name = "user_id"
    type = "NUMBER"
  }

  argument {
    name = "new_status"
    type = "BOOLEAN"
  }

  statement = <<-EOT
BEGIN
        UPDATE users SET is_active = new_status WHERE id = user_id
EOT
}

resource "snowflake_procedure" "procedure_admin_bulk_update_products" {
  name     = "bulk_update_products"
  schema   = "admin"
  language = "SQL"
  return_type = "TABLE"

  argument {
    name = "category_filter"
    type = "VARCHAR"
    default_value = "'electronics'"
  }

  argument {
    name = "price_multiplier"
    type = "NUMBER"
    default_value = "1.1"
  }

  argument {
    name = "update_timestamp"
    type = "TIMESTAMP_NTZ"
    default_value = "CURRENT_TIMESTAMP("
  }

  statement = <<-EOT
$$
    DECLARE
        updated_count NUMBER DEFAULT 0;
        result_cursor CURSOR FOR 
            SELECT product_id, price, price * price_multiplier as new_price
            FROM sales.products 
            WHERE category = category_filter;
    BEGIN
        FOR record IN result_cursor DO
            UPDATE sales.products 
            SET price = record.new_price, 
                modified_at = update_timestamp
            WHERE product_id = record.product_id;

            updated_count := updated_count + 1;
        END FOR;

        RETURN TABLE(
            SELECT product_id, price as old_price, price * price_multiplier as new_price
            FROM sales.products 
            WHERE category = category_filter
        );
    END;
    $$
EOT
}

resource "snowflake_table" "table_data_warehouse_fact_sales" {
  name     = "fact_sales"
  schema   = "data_warehouse"
  cluster_by = ["partition_date", "customer_data:customer_id"]

  column {
    name = "sale_id"
    type = "NUMBER(38,0)"
    nullable = false
  }

  column {
    name = "customer_data"
    type = "OBJECT"
  }

  column {
    name = "sale_items"
    type = "ARRAY"
  }

  column {
    name = "metadata"
    type = "VARIANT"
  }

  column {
    name = "geo_location"
    type = "GEOGRAPHY"
  }

  column {
    name = "sale_timestamp"
    type = "TIMESTAMP_TZ"
  }

  column {
    name = "partition_date"
    type = "DATE"
  }
}

resource "snowflake_view" "view_analytics_customer_insights" {
  name     = "customer_insights"
  schema   = "analytics"
  statement = <<-EOT
SELECT 
        c.customer_id,
        c.customer_name,
        ARRAY_AGG(DISTINCT p.category) as purchased_categories,
        COUNT(DISTINCT fs.sale_id) as total_orders,
        SUM(fs.sale_items[0]:amount::NUMBER) as total_spent,
        MAX(fs.sale_timestamp) as last_purchase_date
    FROM customers c
    JOIN data_warehouse.fact_sales fs ON c.customer_id = fs.customer_data:"customer_id"::NUMBER
    JOIN sales.products p ON p.product_id = fs.sale_items[0]:product_id::NUMBER
    WHERE fs.sale_timestamp >= DATEADD(year, -1, CURRENT_TIMESTAMP())
    GROUP BY c.customer_id, c.customer_name
    HAVING total_orders >= 5
    ORDER BY total_spent DESC
EOT
}
