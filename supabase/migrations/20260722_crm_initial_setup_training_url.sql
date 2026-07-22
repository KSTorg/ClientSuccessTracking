-- Set training URL for "CRM + Initial Setup" task (both Incubator and Accelerator)
UPDATE tasks
SET training_url = 'https://courses.kst-marketing.com/courses/products/d3f334fd-12e1-46dd-aff0-97b462eb66bc/categories/cce6b180-5e6e-4761-97e5-8d672cda43f6?source=courses'
WHERE title ILIKE '%CRM%Initial Setup%'
  AND training_url IS NULL;
