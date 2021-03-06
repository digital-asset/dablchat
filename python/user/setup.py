import os
from setuptools import setup

setup(name='daml-chat-user-bot',
      version=os.environ.get('DDIT_VERSION', 'release'),
      description='Daml Chat User',
      author='Digital Asset',
      license='Apache2',
      install_requires=['dazl>=7,<8', 'aiohttp'],
      packages=['bot'],
      include_package_data=True)
