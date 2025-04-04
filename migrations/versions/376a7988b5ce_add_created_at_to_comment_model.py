"""Add created_at to Comment model

Revision ID: 376a7988b5ce
Revises: 12dcc5bbae87
Create Date: 2025-01-01 02:03:10.577821

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '376a7988b5ce'
down_revision = '12dcc5bbae87'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('comment', schema=None) as batch_op:
        batch_op.add_column(sa.Column('created_at', sa.DateTime(), nullable=True))

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('comment', schema=None) as batch_op:
        batch_op.drop_column('created_at')

    # ### end Alembic commands ###
